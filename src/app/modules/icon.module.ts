import { NgModule } from "@angular/core";
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";

@NgModule({
    imports: [MatIconModule]
})
export class IconModule {
    private path: string = "../../assets"
    constructor(
        private domSanitizer: DomSanitizer,
        public matIconRegistry: MatIconRegistry
    ) {
        this.matIconRegistry.addSvgIcon(
            "senzary-isotype", 
            this.setPath(`${this.path}/senzary-isotype.svg`));
    };
    private setPath(url: string): SafeResourceUrl {
        return this.domSanitizer.bypassSecurityTrustResourceUrl(url);
    };
};
