import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import {
    BaseData,
    HasId,
    PageComponent,
} from '@shared/public-api';
import { AppState } from '@core/public-api';
import { Store } from '@ngrx/store';
import {
    EntityNode,
    IEntityInfoWithChildren,
    IEntityNode
} from './hierarchyTree.models';
import { WidgetContext } from '@app/modules/home/models/widget-component.models';


/**
 * @title Hierarchy Tree
 */
@Component({
    selector: 'tb-hierarchy-tree',
    templateUrl: './hierarchyTree.component.html',
    styleUrls: ['./hierarchyTree.component.scss']
})
export class HierarchyTreeComponent<T extends BaseData<HasId>> extends PageComponent implements OnInit {
    @Input() ctx: WidgetContext;
    @Input() selectedItem?: T;
    @Input() dataSource: IEntityNode[];
    @Output() clickOnChildrenIcon: EventEmitter<IEntityNode> = new EventEmitter();
    constructor(
        protected store: Store<AppState>,
        private changeDetection: ChangeDetectorRef
    ) { 
        super(store);
        this.changeDetection = changeDetection; 
    }
    childrenAccessor = (node: IEntityNode) => node.children;
    hasChild = (_: number, node: IEntityNode) => !!node.children;
    childrenIconClick(node: IEntityNode) {
        this.clickOnChildrenIcon.emit(node);
    };
    ngOnInit() {
        // this.ctx.$scope.tree = this;
        console.log('>>> ngOnInit for hierarchy tree');
    };
}
