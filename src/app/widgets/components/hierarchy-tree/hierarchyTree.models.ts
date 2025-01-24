import { BaseData, EntityId, EntityType, HasId } from '@shared/public-api';

export interface IEntityNode {
    entityId: EntityId;
    name: string;
    children?: IEntityNode[];
    group?: string;
    setChildren?(items: IEntityInfoWithChildren[]): void;
};

export interface FlatNode extends IEntityNode {
    expandable: boolean;
    disabled?: boolean;
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
    group: string;
    protected _children?: IEntityNode[];
    constructor(item: IEntityInfoWithChildren, group?: string) {
        this.name = item.name;
        this.entityId = item.id;
        this.group = 'base';
        if (group) this.group = group;
        if (this.entityId.entityType !== EntityType.ENTITY_GROUP) return;
        this.group = this.name;
        this.setChildren(item.children, this.group);
    }
    public get children(): IEntityNode[] {
        return this._children;
    }
    public setChildren(items: IEntityInfoWithChildren[], groupName?: string) {
        this._children = [];
        for (const item of items) {
            this._children.push(new EntityNode(item, groupName));
        }
    }
};
