// mapshaper ships no types; only the programmatic entry point the build uses
declare module "mapshaper" {
  const mapshaper: {
    applyCommands(commands: string, input: Record<string, unknown>): Promise<Record<string, string | Buffer>>;
  };
  export default mapshaper;
}
