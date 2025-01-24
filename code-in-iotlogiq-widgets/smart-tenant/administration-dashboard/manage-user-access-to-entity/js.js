const $injector = widgetContext.$scope.$injector;
const rxjs = widgetContext.rxjs;
const dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
const customDialog = $injector.get(widgetContext.servicesMap.get('customDialog'));
const attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));
const entityService = $injector.get(widgetContext.servicesMap.get('entityService'));
const stateController = widgetContext.stateController;
const customerService = $injector.get(widgetContext.servicesMap.get("customerService"));
const userService = $injector.get(widgetContext.servicesMap.get("userService"));
const entityRelationService = $injector.get(widgetContext.servicesMap.get("entityRelationService"));

openEntityAccessDialog();

function EntityAccessDialogController(instance) {
    const vm = instance;
    const params = stateController.getStateParams();
    vm.entityId = entityId;
    vm.entityName = entityName;
    vm.entityType = entityId.entityType.charAt(0);
    vm.entityType += entityId.entityType.slice(1).toLowerCase();
    // set up current customer
    vm.customer = params.currentCustomer;
    vm.customers = [];
    vm.customerUsers = [];
    // set up functions
    vm.updateAvailableUsers = function (event) {
        const customer = event.value;
        updateUsers(customer, vm).subscribe();
    };
    vm.userAccessToBe = function (event, user) {
        const accessIstoBe = event.checked;
        let accessUpdateObservable;
        // if access is to be true get chain of parents assets with access_users
        if (accessIstoBe) accessUpdateObservable = grantAccess(user, vm);
        // is access is to be false get all children assets & devices with access_users
        if (!accessIstoBe) accessUpdateObservable = revokeAccess(user, vm);
        // refresh entity
        const organisation = vm.entityAccessFormGroup.get("organisation").value;
        accessUpdateObservable.pipe(
            rxjs.switchMap(() => refreshEntity(vm)),
            rxjs.switchMap(() => updateUsers(organisation, vm))
        ).subscribe();
    };
    vm.cancel = function () {
        vm.dialogRef.close(null);
    };
    // set up form
    vm.entityAccessFormGroup = vm.fb.group({
        organisation: [null, []]
    });
    // resolve entity to be accessed
    const refreshEntityObservable = refreshEntity(vm);
    // set up all customers for this user
    const customersObservable = refreshEntityObservable.pipe(
        rxjs.switchMap(() => getAllCustomers()),
        rxjs.switchMap(function (customers) {
            vm.customers = customers;
            let defaultCustomer = customers.find(c => c.title === vm.customer.entityName);
            if (!defaultCustomer) defaultCustomer = customers[0];
            const formControl = vm.entityAccessFormGroup.get("organisation");
            formControl.setValue(defaultCustomer);
            formControl.updateValueAndValidity();
            return updateUsers(defaultCustomer, vm);
        })
    );
    // subscribe
    customersObservable.subscribe();
}

function openEntityAccessDialog() {
    customDialog.customDialog(
        htmlTemplate,
        EntityAccessDialogController
    ).subscribe();
}

function refreshEntity(vm) {
    return getTargetEntity(vm.entityId).pipe(
        rxjs.switchMap(function (response) {
            vm.entity = response;
            const parents = getRelatives(vm.entity).pipe(
                rxjs.tap((response) => vm.entityParents = response)
            );
            const children = getRelatives(vm.entity, "children")
                .pipe(rxjs.tap((response) => vm.entityChildren = response)
                );
            return rxjs.forkJoin([parents, children]);
        })
    );
}

function updateUsers(customer, vm) {
    // get users for this customer
    const getUsersObservable = getAvailableUsers(customer);
    // get access_users attribute for entity
    const getWhitelistObservable = getUsersWithAccess(vm.entityId, vm.entity.type);
    return rxjs.forkJoin([
        getUsersObservable,
        getWhitelistObservable
    ]).pipe(
        rxjs.map((responses) => {
            const availableUsers = responses[0];
            const item = responses[1];
            return availableUsers.map(
                (availableUser) => {
                    let email = availableUser.email;
                    if (!email) {
                        email = availableUser.name;
                        availableUser.email = email;
                    }
                    if (item.usersWithAccess.find(e => e === email)) {
                        availableUser.checked = true;
                    } else availableUser.checked = false;
                    return availableUser;
                }
            );
        }),
        rxjs.tap((users) => vm.customerUsers = users)
    );
}

function revokeAccess(user, vm) {
    // go through children + self & check if user has access
    const items = Array.from(vm.entityChildren);
    items.push({
        entityId: vm.entity.id,
        usersWithAccess: vm.customerUsers
            .filter(user => user.checked)
            .map(user => user.email),
        type: vm.entity.type
    });
    const accessItems = items.filter((item) => item.usersWithAccess
        .find(u => u === user.email));
    console.log(">>> 💙 revoking access for", accessItems);
    return rxjs.from(accessItems).pipe(
        rxjs.concatMap(function (item) {
            let relationType = "accessToMachine";
            if (item.type === "area") relationType = "accessToArea";
            if (item.type === "location") relationType = "accessToLocation";
            let relationshipObservable = rxjs.of(null);
            if (item.type !== "device") {
                const query = {
                    filters: [{ relationType: relationType }],
                    parameters: {
                        rootId: item.entityId.id,
                        rootType: item.entityId.entityType,
                        direction: "FROM",
                        relationTypeGroup: "COMMON",
                        pageLink: widgetContext.pageLink(100, 0, '', {
                            property: 'name',
                            direction: 'ASC'
                        }),
                        maxLevel: 1
                    }
                };
                relationshipObservable = entityRelationService.findByQuery(query).pipe(
                    rxjs.catchError(function (error) {
                        console.error(">>> 📛 error:", error);
                        return rxjs.of({ error: error });
                    })
                ).pipe(
                    rxjs.switchMap(function (relationsQuery) {
                        const relation = relationsQuery.find(
                            r => r.to.id == user.id.id
                        );
                        if (!relation) return rxjs.of(null);
                        return entityRelationService.deleteRelation(
                            relation.from,
                            relationType,
                            relation.to
                        );
                    })
                );
            }
            return relationshipObservable;
        }),
        rxjs.toArray()
    );
}

function grantAccess(user, vm) {
    // go through parents + children & check if user has access
    const items = Array.from(vm.entityParents).concat(vm.entityChildren); // [{entityId, usersWithAccess}]
    items.push({
        entityId: vm.entity.id,
        usersWithAccess: vm.customerUsers
            .filter(user => user.checked)
            .map(user => user.email),
        type: vm.entity.type
    });
    // if has access, skip
    const noAccessItems = items.filter((item) => !item.usersWithAccess
        .find(u => u === user.email));
    // if not, add to array and update attribute
    return rxjs.from(noAccessItems).pipe(
        rxjs.concatMap(function (item) {
            // check if relation is present, if it's not, create it
            let relationType;
            if (item.type === "machine") relationType = "accessToMachine";
            if (item.type === "area") relationType = "accessToArea";
            if (item.type === "location") relationType = "accessToLocation";
            let relationshipObservable = rxjs.of(null);
            if (relationType) {
                const query = {
                    filters: [{ relationType: relationType }],
                    parameters: {
                        rootId: item.entityId.id,
                        rootType: item.entityId.entityType,
                        direction: "FROM",
                        relationTypeGroup: "COMMON",
                        pageLink: widgetContext.pageLink(100, 0, '', {
                            property: 'name',
                            direction: 'ASC'
                        }),
                        maxLevel: 1
                    }
                };
                relationshipObservable = entityRelationService.findByQuery(query).pipe(
                    rxjs.catchError(function (error) {
                        console.error(">>> 📛 error:", error);
                        return rxjs.of({ error: error });
                    })
                ).pipe(
                    rxjs.switchMap(function (relationsQuery) {
                        const relation = relationsQuery.find(
                            r => r.to.id == user.id.id
                        );
                        if (relation) return rxjs.of(null);
                        return entityRelationService.saveRelation({
                            from: item.entityId,
                            type: relationType,
                            to: user.id
                        });
                    })
                )
            }
            return relationshipObservable;
        }),
        rxjs.toArray()
    );
}

function getAllCustomers() {
    const pageLink = widgetContext.pageLink(100, 0);
    return customerService.getUserCustomers(pageLink).pipe(
        rxjs.map((response) => response.data.map(
            customer => {
                customer.optionLabel = entityNameToHuman(customer.title);
                return customer;
            }
        ))
    );
}

function entityNameToHuman(entityNameString) {
    const parts = entityNameString.split(" ");
    if (!isNaN(parts[0])) parts.shift();
    return parts.join(" ");
}

function getTargetEntity(idObject) {
    return entityService.getEntity(
        idObject.entityType,
        idObject.id
    ).pipe(
        rxjs.map((response) => {
            response.deviceProfile = response.type;
            if (response.id.entityType === "DEVICE") response.type = "device";
            else if (!["area", "location", "machine"].includes(response.type)) response
                .type = "machine";
            return response;
        })
    );
}

function getRelatives(entity, nature = "parents") {
    let direction = "FROM";
    let relations = getChildrenRelationsFor(entity.type);
    if (nature === "parents") {
        direction = "TO";
        relations = getParentRelationsFor(entity.type);
    }
    if (relations.length === 0) return rxjs.of([]);
    const query = {
        filters: relations.map(r => ({ relationType: r })),
        parameters: {
            rootId: entity.id.id,
            rootType: entity.id.entityType,
            direction: direction,
            relationTypeGroup: "COMMON",
            pageLink: widgetContext.pageLink(100, 0, '', {
                property: 'name',
                direction: 'ASC'
            }),
            maxLevel: 5
        }
    };
    return entityRelationService.findByQuery(query).pipe(
        rxjs.switchMap((relationships) => rxjs.from(relationships))
    ).pipe(
        rxjs.concatMap((relation) => {
            const oppositeDirection = direction === "FROM" ? "to" : "from";
            return getTargetEntity(relation[oppositeDirection]);
        }),
        rxjs.concatMap((relatedEntity) => getUsersWithAccess(
            relatedEntity.id,
            relatedEntity.type
        )),
        rxjs.toArray()
    );
}

function getParentRelationsFor(type) {
    if (type === "location") return [];
    const relations = [
        "areaToLocation",
        "machineToArea",
        "deviceToArea",
        "deviceToMachine"
    ];
    if (type === "area") relations.splice(1);
    if (type === "machine") relations.splice(2);
    return relations;
}

function getChildrenRelationsFor(type) {
    if (!["area", "location", "machine"].includes(type)) return [];
    const relations = [
        "deviceToMachine",
        "deviceToArea",
        "machineToArea",
        "areaToLocation"
    ];
    if (type === "area") relations.pop();
    if (type === "machine") relations.splice(1);
    return relations;
}

function getUsersWithAccess(entityId, type) {
    return attributeService.getEntityAttributes(
        entityId,
        "SERVER_SCOPE",
        ["access_users"]
    ).pipe(rxjs.map((latestValues) => {
        let currentAccessUsers = [];
        for (const attribute of latestValues) {
            if (attribute.key === "access_users") {
                if (attribute.value !== "") currentAccessUsers = attribute.value;
                break;
            }
        }
        if (typeof currentAccessUsers === "string") {
            currentAccessUsers = currentAccessUsers.split(" ");
        }
        return {
            entityId: entityId,
            type: type,
            usersWithAccess: currentAccessUsers
        };
    }));
}

function getAvailableUsers(customer) {
    const pageLink = widgetContext.pageLink(1000, 0);
    return userService.getCustomerUsers(
        customer.id.id,
        pageLink
    ).pipe(rxjs.map((response) => response.data));
}



