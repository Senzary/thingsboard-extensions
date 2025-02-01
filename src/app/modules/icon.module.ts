import { NgModule } from "@angular/core";
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";

@NgModule({
    imports: [MatIconModule]
})
export class IconModule {
    private path: string = "/api/images/public";
    constructor(
        private domSanitizer: DomSanitizer,
        public matIconRegistry: MatIconRegistry
    ) {
        this.matIconRegistry.addSvgIcon(
            "senzary-isotype", 
            this.setPath(`${this.path}/W1X6EmcMXhgVZ0EYj0PGPtCQ0jxEM4SW`));
    };
    private setPath(url: string): SafeResourceUrl {
        return this.domSanitizer.bypassSecurityTrustResourceUrl(url);
    };
};
