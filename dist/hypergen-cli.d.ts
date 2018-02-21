import { CliApp } from "./cli-app";
export default class HypergenCli extends CliApp {
    private hpg;
    protected beforeCommand(): void;
    protected afterCommand(): void;
    protected _init(): void;
    private start(name, options);
    private rename(name);
    private add(fileOrDir, otherFilesOrDirs);
    private remove(fileOrDir, otherFilesOrDirs);
    private printTemplateInfo(tinfo);
    private usename(name);
    private show(fileOrDir, otherFilesOrDirs);
    private generate(options);
    private inquire();
}
