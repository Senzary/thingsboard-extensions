import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Breadcrumbs, IBreadcrumb } from './breadcrumbs.models';
import { WidgetContext } from '../../models/widget-component.models';

@Component({
    selector: 'tb-breadcrumbs',
    templateUrl: './breadcrumbs.component.html',
    styleUrls: ['./breadcrumbs.component.scss']
})
export class BreadcrumbsComponent<T> implements OnInit {
    @Input() ctx: WidgetContext;
    @Input() breadcrumbs: Breadcrumbs<T>;
    @Output() clickOnBreadcrumb: EventEmitter<IBreadcrumb<T>> = new EventEmitter();

    constructor() {};
    ngOnInit() {
        return;
    }
    breadcrumbClick(item: IBreadcrumb<T>): void {
        this.clickOnBreadcrumb.emit(item);
    }
};
