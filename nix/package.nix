{
  lib,
  buildNpmPackage,
  nodejs,
  makeWrapper,
}:

buildNpmPackage {
  pname = "iam-legend-lsp";
  version = "0.0.0";
  src = ./..;
  npmDepsHash = "sha256-3gNoAcEUnrbNdyx7pmiy4iBI/Z5CVIs6ZcH/ITQ0S+k=";
  dontNpmBuild = true;
  nativeBuildInputs = [
    makeWrapper
  ];
  installPhase = ''
    runHook preInstall

    mkdir -p $out/lib/iam-legend-lsp
    cp -r node_modules $out/lib/iam-legend-lsp/
    cp -r src $out/lib/iam-legend-lsp/
    cp package.json $out/lib/iam-legend-lsp/

    mkdir -p $out/bin
    makeWrapper ${nodejs}/bin/node $out/bin/iam-legend-lsp \
      --add-flags "--experimental-strip-types" \
      --add-flags "$out/lib/iam-legend-lsp/src/server.ts"

    runHook postInstall
  '';

  meta = {
    description = "IAM policy actions autocomplete, documentation & wildcard resolution — standalone LSP server";
    mainProgram = "iam-legend-lsp";
    homepage = "https://github.com/mbarneyjr/iam-legend-lsp";
    license = lib.licenses.mit;
    platforms = [
      "x86_64-linux"
      "aarch64-linux"
      "x86_64-darwin"
      "aarch64-darwin"
    ];
    maintainers = with lib.maintainers; [
      mbarneyjr
    ];
  };
}
