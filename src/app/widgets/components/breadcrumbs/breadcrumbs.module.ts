import { NgModule } from '@angular/core';
import { BreadcrumbsComponent } from './breadcrumbs.component';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from 'primeng/api';

@NgModule({
    declarations: [BreadcrumbsComponent],
    imports: [
        CommonModule,
        MatIconModule,
        SharedModule
    ],
    exports: [BreadcrumbsComponent]
})
export class BreadcrumbsModule {};
