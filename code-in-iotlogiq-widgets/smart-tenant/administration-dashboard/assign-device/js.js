/*========================================================================*/
/*=========================  Add entity example  =========================*/
/*========================================================================*/

let $injector = widgetContext.$scope.$injector;
const rxjs = widgetContext.rxjs;
let customDialog = $injector.get(widgetContext.servicesMap
    .get('customDialog'));
let assetService = $injector.get(widgetContext.servicesMap
    .get('assetService'));
let deviceService = $injector.get(widgetContext.servicesMap
    .get('deviceService'));
let entityService = $injector.get(widgetContext.servicesMap
    .get('entityService'));
let entityGroupService = $injector.get(widgetContext
    .servicesMap.get('entityGroupService'));
let attributeService = $injector.get(widgetContext
    .servicesMap.get('attributeService'));
let entityRelationService = $injector.get(widgetContext
    .servicesMap.get('entityRelationService'));
const stateController = widgetContext.stateController;

openAddEntityDialog();

function openAddEntityDialog() {
    customDialog.customDialog(
        htmlTemplate,
        AddEntityDialogController
    ).subscribe();
}

function AddEntityDialogController(instance) {
    let vm = instance;
    const params = stateController.getStateParams();
    vm.customer = params.currentCustomer;
    vm.currentLocation = params.currentLocation;
    // set customer device groups
    vm.unassignedDevices = [];
    const deviceGroupsObservable = getCustomerDeviceGroups(vm.customer).pipe(
        rxjs.tap((groups) => {
            vm.unassignedGroup = groups.find(g => g.name === "Unassigned Devices");
            vm.assignedGroup = groups.find(g => g.name === "Assigned Devices");
        })
    );
    const unassignedDevicesObservable = getDevicesForGroup(
        deviceGroupsObservable,
        "Unassigned Devices"
    ).pipe(rxjs.tap((devices) => vm.unassignedDevices = devices));
    unassignedDevicesObservable.subscribe(function (response) {
        if (response.error) vm.error = response.error;
    });
    vm.selectedLongListHeroes = [];
    vm.selectedCustomer = vm.customer;
    vm.addEntityFormGroup = vm.fb.group({
        owner_type: ['area'],
        selectedEntity: [null, [vm.validators.required]],
        selectedDevices: [null, [vm.validators.required]],
        searchtext: ['']
    });
    updateEntitiesDropdown('area');

    // init();

    vm.cancel = function () {
        vm.dialogRef.close(null);
    };
    vm.remove = function (device) {
        const index = vm.selectedDevices.indexOf(
            device);

        if (index >= 0) {
            vm.selectedDevices.splice(index, 1);
        }
        uncheckFromMasterList(device);
    }
    function uncheckFromMasterList(device) {
        const index = vm.unassignedDevices.indexOf(device);
        if (index >= 0) {
            vm.unassignedDevices[index].selected = false;
        }
    }
    vm.onSelectedOptionsChange = function (event) {
        //console.log(`${JSON.stringify(event)}`);
        vm.selectedDevices = event;
    }

    vm.filter = function (heroes, searchText) {
        if (searchText == null || heroes == null) {
            return heroes;
        }
        return heroes.filter(hero => hero.name
            .toLowerCase().indexOf(searchText
                .toLowerCase()) !== -1);
    }
    vm.ownerTypeChanged = function (event) {
        updateEntitiesDropdown(event.value);
    }


    function assignDevices(devices, relationType, selectedAsset) {
        return rxjs.from(devices).pipe(
            rxjs.concatMap((device) => {
                // remove from unassigned devices
                const removeFromUnassinedObservable = entityGroupService
                    .removeEntityFromEntityGroup(
                        vm.unassignedGroup.id.id,
                        device.id.id
                    );
                // add to assigned group
                const addToAssignedObservable = entityGroupService
                    .addEntityToEntityGroup(
                        vm.assignedGroup.id.id,
                        device.id.id
                    );
                return rxjs.forkJoin([
                    removeFromUnassinedObservable,
                    addToAssignedObservable
                ]).pipe(
                    rxjs.switchMap(function () {
                        return rxjs.of(device);
                    })
                );
            }),
            rxjs.concatMap((device) => {
                // delete current relationType
                return entityRelationService.findByToAndType(
                    device.id,
                    relationType
                ).pipe(
                    rxjs.switchMap(function (relations) {
                        if (!relations || relations.length === 0) return rxjs
                            .of(device);
                        return rxjs.from(relations).pipe(
                            rxjs.concatMap((relation) => {
                                return entityRelationService.deleteRelation(
                                    relation.from,
                                    relationType,
                                    relation.to
                                );
                            }),
                            rxjs.switchMap(() => rxjs.of(device))
                        );
                    })
                )
            }),
            rxjs.concatMap((device) => {
                // relate according to relation type
                const relation = {
                    from: selectedAsset.id,
                    to: device.id,
                    typeGroup: "COMMON",
                    type: relationType
                };
                return entityRelationService.saveRelation(relation).pipe(
                    rxjs.switchMap(function () {
                        return rxjs.of(device);
                    })
                );
            }),
            rxjs.concatMap((device) => saveAttributes(device.id).pipe(
                rxjs.switchMap(function () {
                    return rxjs.of(device);
                })
            )),
            rxjs.toArray()
        );
    }

    vm.save = function () {
        const formValues = vm.addEntityFormGroup.value;
        var selectedDevices = formValues.selectedDevices;
        var selectedEntity = formValues.selectedEntity;
        var ownerType = formValues.owner_type;
        var relationType = '';

        if (ownerType == 'area') {
            relationType = 'deviceToArea';
        } else {
            relationType = 'deviceToMachine';
        }
        // assign devices & update attributes
        const assignedDevicesObservable = assignDevices(
            selectedDevices,
            relationType,
            selectedEntity
        );
        // run
        assignedDevicesObservable.subscribe((response) => {
            console.log(">>> 💚 response", response);
            widgetContext.updateAliases();
            vm.dialogRef.close(null);
        });
    };

    function saveAttributes(entityId) {
        const formValues = vm.addEntityFormGroup.value;
        const params = widgetContext.stateController.getStateParams();
        let attributesArray = [];
        attributesArray.push({
            key: "related_location",
            value: params.currentLocation.entityName
        }, {
            key: "related_customer",
            value: params.currentCustomer.entityName
        });
        if (formValues.selectedEntity.type === "area") {
            attributesArray.push({
                key: "related_area",
                value: formValues.selectedEntity.name
            });
        } else if (
            formValues.selectedEntity.type === "machine" ||
            formValues.selectedEntity.type === "asset"
        ) {
            attributesArray.push({
                key: "related_area",
                value: params.currentArea.entityName
            }, {
                key: "related_asset",
                value: formValues.selectedEntity.name
            });
        }
        if (attributesArray.length > 0) {
            return attributeService.saveEntityAttributes(
                entityId,
                "SERVER_SCOPE",
                attributesArray
            );
        }
        return widgetContext.rxjs.of([]);
    }

    function getCustomerEntitiesByType(entityType) {
        let property = "name";
        let direction = "ASC";
        var pageLink = widgetContext.pageLink(100, 0,
            null, {
            property,
            direction
        });
        return assetService.getCustomerAssets(vm
            .selectedCustomer.entityId.id, pageLink,
            entityType).pipe(
                widgetContext.rxjs.map((response) => {
                    if (response) {
                        return response;
                    }
                })
            );
    }

    function updateEntitiesDropdown(ownerType) {
        getCustomerEntitiesByType(ownerType)
            .subscribe(response => {
                let formattedData = response.data.map(item => {
                    let name = item.name
                    let splittedName = name.split(" ")
                    if (parseInt(splittedName[0])) {
                        splittedName = splittedName.slice(1); // Corrected line
                        item.name = splittedName.join(" ");
                        return item
                    }
                    return item
                })
                vm.addEntityFormGroup.value
                    .selectedEntity = null;
                vm.addEntityFormGroup.patchValue({
                    selectedEntity: null
                }, {
                    emitEvent: true
                });
                vm.entities = formattedData;
            });
    }

    function getCustomerDeviceGroups(customer) {
        return entityGroupService.getEntityGroupsByOwnerId(
            customer.entityId.entityType,
            customer.entityId.id,
            "DEVICE"
        );
    }

    function getDevicesForGroup(groupsObservable, groupName) {
        const pageLink = widgetContext.pageLink(50, 0);
        return groupsObservable.pipe(
            rxjs.switchMap(function (groups) {
                const group = groups.find(g => g.name === groupName);
                if (!group) throw new Error("no such group 😐");
                return entityGroupService.getEntityGroupEntities(
                    group.id.id,
                    pageLink,
                    null,
                    {},
                    "DEVICE"
                );
            }),
            rxjs.map(function (response) {
                return response.data;
            }),
            rxjs.catchError(function (error) {
                console.error(">>> 📛 error:", error);
                return rxjs.of({ error: error });
            })
        );
    }
}