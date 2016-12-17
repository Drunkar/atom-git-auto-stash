'use babel';

export default class GitAutoStashView {
    defaultText = "no auto-stashes";

    constructor(serializedState) {
        // Create root element
        this.element = document.createElement('div');

        title = document.createElement('span');
        title.style.paddingLeft = "12.5px";
        title.textContent = "git-auto-stash:"
        this.element.appendChild(title);

        content = document.createElement('span');
        content.style.paddingLeft = "6px";
        content.textContent = this.defaultText;
        this.element.appendChild(content);
    }

    // Returns an object that can be retrieved when package is activated
    serialize() {}

    // Tear down any state and detach
    destroy() {
        this.element.remove();
    }

    getElement() {
        return this.element;
    }

    updateFooterPanelContent(text) {
        if (!text) text = this.defaultText;
        this.element.childNodes[1].textContent = text;
    }

}
