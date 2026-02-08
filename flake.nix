{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/25.11";
  };

  outputs =
    { nixpkgs, ... }:
    let
      systems = [ "x86_64-linux" ];
    in
    {
      devShells = nixpkgs.lib.genAttrs systems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs
              vsce
            ];
          };
        }
      );
    };
}
