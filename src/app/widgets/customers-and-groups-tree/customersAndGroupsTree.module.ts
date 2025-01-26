import { NgModule } from "@angular/core";
import { CustomersAndGroupsTreeComponent } from "./customersAndGroupsTree.component";
import { BreadcrumbsModule, HierarchyTreeModule } from "../../public-api";

@NgModule({
    declarations: [ CustomersAndGroupsTreeComponent ],
    imports: [
        HierarchyTreeModule,
        BreadcrumbsModule
    ],
    exports: [
        CustomersAndGroupsTreeComponent
    ]
})
export class CustomersAndGroupsModule {}
