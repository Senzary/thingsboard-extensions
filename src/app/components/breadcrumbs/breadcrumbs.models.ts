import { BaseData, HasId } from '@shared/public-api';

export interface IBreadcrumb<T extends BaseData<HasId>> {
    id: string;
    name: string;
    data?: T;
    next?: IBreadcrumb<T>;
    previous?: IBreadcrumb<T>;
};

export class Breadcrumb<T extends BaseData<HasId>> implements IBreadcrumb<T> {
    id: string;
    name: string;
    data?: T;
    next?: IBreadcrumb<T>;
    previous?: IBreadcrumb<T>;
    constructor(item: T) {
        this.id = item.id.id;
        this.name = item.name;
        this.data = item;
    }
};

export class Breadcrumbs<T extends BaseData<HasId>> {
    root?: IBreadcrumb<T>;
    active?: IBreadcrumb<T>;
    constructor(root?: T) {
        if (!root) return;
        this.root = new Breadcrumb<T>(root);
    }
    addItem(newItem: T): Breadcrumb<T> {
        const item = new Breadcrumb(newItem);
        if (!this.root) {
            this.root = item;
            this.active = this.root;
            return;
        }
        this.active.next = item;
        item.previous = this.active;
        this.active = this.active.next;
        return item;
    }
    jumpTo(item: IBreadcrumb<T>) {
        if (item.id === this.active.id) return;
        let found = false;
        while (this.active.previous && !found) {
            this.active = this.active.previous;
            if (item.id === this.active.id) {
                this.active.next = undefined;
                found = true;
            }
        }
        return this.items;
    }
    public get items(): IBreadcrumb<T>[] {
        if (!this.root) return [];
        let item = this.root;
        const results = [item];
        while(!!item.next) {
            results.push(item.next);
            item = item.next;
        }
        return results;
    }
};
