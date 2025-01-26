import { AliasEntityType, BaseData, EntityId, EntityType, HasId } from '@shared/public-api';

export interface IEntityNode {
    entityId: EntityId;
    name: string;
    children?: IEntityNode[];
    disabled?: boolean;
    setChildren?(items: IEntityInfoWithChildren[]): void;
};

export interface FlatNode extends IEntityNode {
    expandable: boolean;
    level: number;
};

export interface IEntityInfoWithChildren extends BaseData<EntityId> {
    children?: IEntityInfoWithChildren[];
};

export interface IEntityGroupsDictionary {
    [key: string]: IEntityInfoWithChildren;
};

export class EntityNode implements IEntityNode {
    entityId: EntityId;
    name: string;
    disabled?: boolean;
    // group: string;
    protected _children?: IEntityNode[];
    constructor(item: IEntityInfoWithChildren) {
        this.name = item.name;
        this.entityId = item.id;
        // this.group = 'base';
        // if (group) this.group = group;
        //if (this.entityId.entityType == EntityType.CUSTOMER) return;
        //this.group = this.name;
        if (!item.children) return;
        if (item.children.length === 0) this.disabled = true;
        this.setChildren(item.children);
    }
    public get children(): IEntityNode[] {
        return this._children;
    }
    public setChildren(items: IEntityInfoWithChildren[]) {
        this._children = [];
        for (const item of items) {
            this._children.push(new EntityNode(item));
        }
    }
};
