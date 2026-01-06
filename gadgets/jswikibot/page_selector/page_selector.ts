import {UserInputOption} from "../utils/input_dialog";

export abstract class PageSelector {
    static readonly inputs: UserInputOption[] = [];

    abstract getDescription(): string;
}

