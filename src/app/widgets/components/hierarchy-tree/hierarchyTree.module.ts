///
/// Copyright © 2023 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { SharedModule } from '@shared/public-api';
import { HierarchyTreeComponent } from './hierarchyTree.component';
import { MatTreeModule } from '@angular/material/tree';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BreadcrumbsModule } from '../breadcrumbs/breadcrumbs.module';

@NgModule({
    declarations: [  HierarchyTreeComponent  ],
    imports: [
        NgClass,
        MatTreeModule,
        CommonModule,
        MatButtonModule,
        MatIconModule,
        SharedModule,
        BreadcrumbsModule
    ],
    exports: [
        HierarchyTreeComponent
    ]
})
export class HierarchyTreeModule {
}
