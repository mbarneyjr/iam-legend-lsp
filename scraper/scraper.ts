import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const DATA_DIR = join(import.meta.dirname, "..", "src", "data", "iam-services");

type CheerioAPI = ReturnType<typeof cheerio.load>;

interface ScrapedAction {
  name: string;
  documentationUrl: string | undefined;
  description: string;
  accessLevel: string;
  resourceTypes: string[];
  conditionKeys: string[];
  dependentActions: string[];
}

interface ScrapedResourceType {
  name: string;
  arn: string;
  conditionKeys: string[];
}

const scrapeServices = async (url: string, browser: puppeteer.Browser) => {
  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: "networkidle0",
  });

  const content = await page.content();
  const $ = cheerio.load(content);

  const services: { name: string; url: string }[] = [];
  $("#main-col-body .highlights ul a").each((_, el) => {
    const name = $(el).text();
    const serviceDocsUrl = `${url.slice(0, url.lastIndexOf("/"))}/${$(el).attr(
      "href"
    )}`;
    services.push({ name, url: serviceDocsUrl });
  });

  await page.close();
  return services;
};

const scrapeService = async (url: string, browser: puppeteer.Browser) => {
  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: "networkidle0",
  });

  const content = await page.content();
  const $ = cheerio.load(content);

  try {
    const servicePrefix = getServicePrefix($);
    const serviceName = getServiceName($);
    const actions = getActions($);
    const resourceTypes = getResourceTypes($);

    await save({ servicePrefix, serviceName, actions, resourceTypes, url });
    console.log(`Successfully scraped: ${url}`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Error scraping: ${url}, skipping.\n reason: ${message}`);
  } finally {
    await page.close();
  }
};

const save = async ({ serviceName, servicePrefix, actions, resourceTypes, url }: {
  serviceName: string;
  servicePrefix: string;
  actions: ScrapedAction[];
  resourceTypes: ScrapedResourceType[];
  url: string;
}) =>
  writeFile(
    join(DATA_DIR, `${formatFileName(serviceName)}.json`),
    JSON.stringify({ serviceName, servicePrefix, url, actions, resourceTypes }, null, 2),
  );

export const formatFileName = (serviceName: string) =>
  serviceName.replace(/\s+/g, "-").replace(/:+/g, "-").toLowerCase();

const getServicePrefix = ($: CheerioAPI) => {
  const elements = $("p > code").toArray();

  for (const element of elements) {
    if ($(element.parent).text().includes("service prefix:")) {
      return $(element).text();
    }
  }

  throw new Error("not service prefix found");
};

const getServiceName = ($: CheerioAPI) => {
  const h1 = $("h1").text();
  return h1.split("keys for ")[1].trim();
};

const getActions = ($: CheerioAPI) => {
  const actionsTable = $("#main-col-body table").first();
  const actionRows = actionsTable.find("tr");

  const actions: ScrapedAction[] = [];
  actionRows.each((_, el) => {
    const tds = $(el).find("td").toArray();
    if (tds.length === 0) return;
    if (tds.length === 6) {
      const [
        name,
        description,
        accessLevel,
        resourceTypes,
        conditionKeys,
        dependentActions,
      ] = tds.map((x) => $(x).text().trim());
      const documentationUrl = $(tds[0]).find("a[href]").first().attr("href");

      actions.push({
        name: name.split(" ")[0],
        documentationUrl,
        description,
        accessLevel,
        resourceTypes: formatToList(resourceTypes),
        conditionKeys: formatToList(conditionKeys),
        dependentActions: formatToList(dependentActions),
      });
      return;
    }

    const [resourceTypes, conditionKeys, dependentActions] = tds.map((td) =>
      formatToList($(td).text()),
    );

    const prevAction = actions[actions.length - 1];
    prevAction.resourceTypes = [...prevAction.resourceTypes, ...resourceTypes];
    prevAction.conditionKeys = [...prevAction.conditionKeys, ...conditionKeys];
    prevAction.dependentActions = [
      ...prevAction.dependentActions,
      ...dependentActions,
    ];
  });

  return actions;
};

const getResourceTypes = ($: CheerioAPI): ScrapedResourceType[] => {
  const tables = $("#main-col-body table");
  if (tables.length < 2) return [];

  const resourceTable = tables.eq(1);
  const rows = resourceTable.find("tr");
  const resourceTypes: ScrapedResourceType[] = [];

  rows.each((_, el) => {
    const tds = $(el).find("td").toArray();
    if (tds.length < 3) return;

    const name = $(tds[0]).text().trim().replace(/\s+/g, "");
    const arn = $(tds[1]).find("code").text().trim();
    const conditionKeys = formatToList($(tds[2]).text().trim());

    if (name && arn) {
      resourceTypes.push({ name, arn, conditionKeys });
    }
  });

  return resourceTypes;
};

const formatToList = (str: string) =>
  str
    .split("\n")
    .map((x) => x.trim().replace(/\s+/, ""))
    .filter((x) => x.length > 0);

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const limit = pLimit(10);
  const services = await scrapeServices(
    "https://docs.aws.amazon.com/service-authorization/latest/reference/reference_policies_actions-resources-contextkeys.html",
    browser,
  );
  if (!services || services.length === 0) {
    throw new Error("no services found");
  }

  await Promise.all(
    services.map(({ url }) =>
      limit(() => {
        console.log("Scraping: ", url);
        return scrapeService(url, browser);
      }),
    ),
  );

  await browser.close();
})();
