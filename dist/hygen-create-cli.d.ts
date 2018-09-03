import { CliApp } from "./cli-app";
export default class HygenCreateCli extends CliApp {
    private hgc;
    protected beforeCommand(): void;
    protected afterCommand(): void;
    protected _init(): void;
    private setopt;
    private start;
    private rename;
    private add;
    private remove;
    private printTemplateInfo;
    private usename;
    private show;
    private generate;
}
