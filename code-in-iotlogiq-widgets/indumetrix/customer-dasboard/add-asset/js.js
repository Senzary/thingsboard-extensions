const assetProfile = "machine";
const currentUserId = widgetContext.currentUser.userId;
const $injector = widgetContext.$scope.$injector;
const customDialog = $injector.get(widgetContext.servicesMap.get("customDialog"));
const assetService = $injector.get(widgetContext.servicesMap.get("assetService"));
const entityRelationService = $injector.get(
    widgetContext.servicesMap.get("entityRelationService")
);
const customerService = $injector.get(widgetContext.servicesMap.get("customerService"));
const entityGroupService = $injector.get(
    widgetContext.servicesMap.get("entityGroupService")
);
const attributeService = $injector.get(widgetContext.servicesMap.get('attributeService'));
const tenantId = widgetContext.currentUser.tenantId.id;
const controller = widgetContext.$scope.ctx.stateController;
const params = controller.getStateParams();

openAddEntityDialog();

function openAddEntityDialog() {
    customDialog.customDialog(htmlTemplate, AddEntityDialogController).subscribe();
}

function AddEntityDialogController(instance) {
    let vm = instance;
    vm.assetProfile = assetProfile;
    vm.assetProfileLabel = assetProfile.charAt(0).toUpperCase() + assetProfile.slice(1);
    const jwtToken = localStorage.getItem("jwt_token");
    const templateFormInit = vm.fb.group({
        template: [null, [vm.validators.required]]
    });
    const fieldsFormInit = vm.fb.group({
        displayName: ["", [vm.validators.required]],
        label: ["", [vm.validators.required]]
    });
    const initial_form_group = vm.fb.group({
        template: templateFormInit,
        fields: fieldsFormInit
    });
    vm.addEntityFormGroup = initial_form_group;
    vm.widgetContext = widgetContext;
    vm.steps = {
        template: { completed: false },
        fields: { completed: false },
        additionalFields: { completed: false },
        thresholdFields: { completed: false },
        mapFields: { completed: false },
        imageFields: { completed: false },
        positionFields: { completed: false }
    };
    vm.entityId = null;
    vm.templates = [];
    vm.chosenTemplate = null;
    vm.customerCode = "";
    vm.assetName = "";
    vm.requiredFields = [];
    vm.additionalFields = [];
    vm.thresholdFields = [];
    vm.mapFields = [];
    vm.imageFields = [];
    vm.positionFields = [];
    vm.subscriptions = [];

    // get customer attribute customerCode
    const customerId = params.currentCustomer.entityId;
    vm.assetOwner = customerId;
    const customerCodeObservable = getCustomerAttributes(customerId, ["customerCode"]);
    customerCodeObservable.subscribe((data) => vm.customerCode = data[0].value);

    // get area from state
    const areaId = params.currentArea.entityId;
    vm.areaId = areaId;

    // get machine templates to update form
    const templateGroupObservable = fetchTemplateGroupByName(assetProfile);
    const groupEntitiesObservable = templateGroupObservable.pipe(
        widgetContext.rxjs.switchMap((response) => {
            const assetProfileTemplatesGroup = response.data[0];
            return fetchEntitiesFromGroup(assetProfileTemplatesGroup.id.id);
        })
    );
    const templatesObservable = groupEntitiesObservable.pipe(
        widgetContext.rxjs.switchMap((response) => {
            const templates = response.data;
            return widgetContext.rxjs.from(templates).pipe(
                widgetContext.rxjs.concatMap((template) => assetService
                    .getAssetInfo(template.id.id)
                )
            );
        }),
        widgetContext.rxjs.toArray()
    );
    templatesObservable.subscribe((assetInfos) => {
        const templatesWithInfo = [];
        for (const assetInfo of assetInfos) {
            const templateName = assetInfo.name.replace(`-${assetProfile}-template`, "");
            assetInfo.templateName = templateName;
            assetInfo.optionLabel = kebabToHuman(templateName);
            templatesWithInfo.push(
                assetInfo
            );
        }
        vm.templates = templatesWithInfo;
    });

    vm.onStepChange = function (event) {
        if (event.selectedIndex == 1) {
            // fetch chosenTemplate fields attribute
            fetchChosenTemplateFields(vm)
                .subscribe((latestAttributes) => {
                    parseTemplateFields(vm, latestAttributes);
                    parseTemplateThresholds(vm, latestAttributes);
                });
        }
    };

    vm.completeMapStep = function (stepper) {
        vm.steps.mapFields.completed = true;
        vm.nextStepOrClose(stepper);
    }

    vm.onTemplateChange = function (event) {
        if (!event.value) vm.steps.template.completed = false;
        vm.chosenTemplate = event.value;
        vm.steps.template.completed = true;
    };

    vm.updateAssetName = function (event) {
        vm.assetName = buildAssetName(vm);
        return;
    };

    vm.checkAssetNameIsUnique = function (event) {
        try {
            const pageLink = widgetContext.pageLink(
                10,
                0,
                vm.assetName
            );
            assetService.getCustomerAssetInfos(
                assetProfile,
                vm.assetOwner.id,
                pageLink
            ).subscribe((response) => {
                const assetWithSameName = response.data.find(
                    assetInfo => assetInfo.name === vm.assetName
                );
                if (assetWithSameName) {
                    vm.addEntityFormGroup.get("fields").get("displayName").setErrors({
                        "notUnique": "Name for " + assetProfile + " should derive in unique-identifier; try using a different name."
                    });
                    return;
                }
                return;
            });
        } catch (error) {
            console.log(">>> 🍎 error:", error);
            return;
        }
    };

    vm.cancel = function () {
        vm.close();
        vm.dialogRef.close(null);
    };

    vm.close = function () {
        vm.entity = null;
        vm.entityId = null;
        vm.entityName = null;
    };

    vm.nextStepOrClose = function (stepper) {
        // figure out if next step?
        if (stepper && stepper._steps.length - 1 > stepper.selectedIndex) {
            stepper.selectedIndex = stepper.selectedIndex + 1;
        } else {
            vm.close();
            vm.dialogRef.close(null);
        }
    }

    vm.save = function (mode = "create", fields = "requiredFields", stepper = undefined) {
        vm.addEntityFormGroup.markAsPristine();
        if (mode === "update") {
            let observable;
            if (fields === "requiredFields") {
                observable = saveRequiredFields(
                    vm,
                    vm.entity.id.id
                );
            } else {
                observable = saveFields(
                    vm,
                    vm.entity.id.id,
                    fields
                );
            }
            observable.subscribe(() => {
                // saveOtherFields(vm, vm.entity.id.id).subscribe(() => {
                widgetContext.updateAliases();
                vm.steps[fields].completed = true;
                vm.nextStepOrClose(stepper);
            }, (error) => console.error(">>> 📛 error:", error));
        } else {
            createAsset(vm).subscribe(
                function (entity) {
                    if (entity) {
                        vm.entity = entity;
                        vm.entityId = entity.id;
                        vm.entityName = entity.name;
                    }
                    vm.steps.fields.completed = true;
                    // Save the machineToArea relationship
                    const machineToAreaObservable = entityRelationService.saveRelation({
                        from: vm.areaId,
                        to: entity.id,
                        type: "machineToArea",
                        typeGroup: "COMMON",
                    });
                    // Save the accessToMachine relationship
                    const accessToMachineObservable = entityRelationService.saveRelation({
                        to: {
                            id: currentUserId,
                            entityType: "USER",
                        },
                        from: {
                            id: entity.id.id,
                            entityType: "ASSET",
                        },
                        type: "accessToMachine",
                        additionalInfo: {
                            addedOn: "create machine customer dashboard."
                        }
                    });
                    // save required attributes
                    const saveAttributesObservable = saveRequiredFields(vm, entity.id.id);
                    // Use forkJoin to combine the saveRelation observables
                    widgetContext.rxjs
                        .forkJoin([
                            machineToAreaObservable,
                            accessToMachineObservable,
                            saveAttributesObservable
                        ]).subscribe(
                            function () {
                                widgetContext.updateAliases();
                                vm.steps.fields.completed = true;
                                vm.nextStepOrClose(stepper);
                            },
                            function (error) {
                                // Handle errors here
                                console.error(">>> 📛 error:", error);
                            }
                        );
                }
            );
        }
    };
}

function buildAssetName(vmInstance) {
    if (!vmInstance.customerCode) throw new Error("no customer code for curent customer 😐");
    let assetName = vmInstance.customerCode + "-" + vmInstance.chosenTemplate.templateName;
    const currentDisplayName = vmInstance.addEntityFormGroup.get("fields").get("displayName").value;
    if (currentDisplayName != "") assetName += "-" + humanToKebab(currentDisplayName);
    const uniqueHash = Math.floor(Math.random() * 0xffffff).toString(16).padEnd(8, "0");
    assetName = assetName.slice(0, 36); // so that names are the same length as tb ids.
    assetName += "-" + uniqueHash; // asset name length + 9 chars...
    return assetName;
};


function getCustomerAttributes(id, keys) {
    return attributeService.getEntityAttributes(id, "SERVER_SCOPE", keys);
}

function fetchTemplateGroupByName(assetProfile) {
    const pageLink = widgetContext.pageLink(10, 0, assetProfile + "-templates");
    return entityGroupService.getEntityGroupsByPageLink(
        pageLink,
        "ASSET"
    );
}

function fetchEntitiesFromGroup(groupId) {
    const pageLink = widgetContext.pageLink(100, 0);
    return entityGroupService.getEntityGroupEntities(
        groupId,
        pageLink,
        null,
        {},
        "ASSET"
    );
}

function fetchCustomerInfo(customerId) {
    return customerService.getCustomer(customerId);
}

function replaceAccents(origin) {
    return origin.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function kebabToHuman(kebabStr) {
    return kebabStr.trim().split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function humanToKebab(humanStr) {
    return replaceAccents(humanStr).trim().toLowerCase().split(" ")
        .map((word) => word
            .replace(/[^a-zA-Z0-9-]/g, '')
            .replace(/[ñ]/g, 'n')
            .replace(/[Ñ]/g, 'N')
        ).join("-");
}

function camelToHuman(camelStr) {
    const words = camelStr.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
    let humanStr = words.shift().toLowerCase();
    humanStr = humanStr.charAt(0).toUpperCase() + humanStr.slice(1);
    for (const word of words) {
        humanStr += ` ${word.toLowerCase()}`;
    }
    return humanStr;
}

function saveRequiredFields(vmInstance, assetId) {
    const fields = vmInstance.requiredFields.filter(
        (field) => !["template", "label"].includes(field.name)
    );
    const fieldValues = vmInstance.addEntityFormGroup.get("fields").value;
    const attributes = [{
        key: "template",
        value: vmInstance.chosenTemplate.name
    }, {
        key: "displayName",
        value: fieldValues["displayName"]
    }];
    for (const field of fields) {
        const key = field.name;
        if (key in fieldValues) {
            attributes.push({
                key: key,
                value: fieldValues[key]
            });
        }
    }
    if (attributes.length == 0) return widgetContext.rxjs.of([]);
    return attributeService.saveEntityAttributes({
        id: assetId,
        entityType: "ASSET"
    }, "SERVER_SCOPE",
        attributes
    );
}

function saveFields(vmInstance, assetId, formGroupName) {
    let fields = vmInstance[formGroupName];
    const attributes = [];
    const fieldValues = {};
    if (vmInstance.addEntityFormGroup.get(formGroupName)) Object.assign(
        fieldValues,
        vmInstance.addEntityFormGroup.get(formGroupName).value
    );
    for (const field of fields) {
        const key = field.name;
        if (key in fieldValues) {

            attributes.push({
                key: key,
                value: fieldValues[key]
            });
        }
    }
    if (attributes.length == 0) return widgetContext.rxjs.of([]);
    return attributeService.saveEntityAttributes({
        id: assetId,
        entityType: "ASSET"
    }, "SERVER_SCOPE",
        attributes
    );
}

function saveOtherFields(vmInstance, assetId) {
    let fields = vmInstance.additionalFields;
    fields = fields.concat(vmInstance.imageFields);
    const attributes = [];
    const fieldValues = {};
    if (vmInstance.addEntityFormGroup.get("additionalFields")) Object.assign(
        fieldValues,
        vmInstance.addEntityFormGroup.get("additionalFields").value
    );
    if (vmInstance.addEntityFormGroup.get("imageFields")) {
        Object.assign(
            fieldValues,
            vmInstance.addEntityFormGroup.get("imageFields").value
        );
    }
    for (const field of fields) {
        const key = field.name;
        if (key in fieldValues) {

            attributes.push({
                key: key,
                value: fieldValues[key]
            });
        }
    }
    if (attributes.length == 0) return widgetContext.rxjs.of([]);
    return attributeService.saveEntityAttributes({
        id: assetId,
        entityType: "ASSET"
    }, "SERVER_SCOPE",
        attributes
    );
}

function parseTemplateThresholds(vmInstance, attributes) {
    const fields = attributes.find((latestAttr) => latestAttr.key === "thresholds");
    if (!fields) return [];
    const fieldsObject = fields.value;
    const thresholdFields = [];
    for (const fieldName in fieldsObject) {
        const field = fieldsObject[fieldName];
        field.name = fieldName;
        if (!("label" in field)) field.label = camelToHuman(
            field.name
        );
        let validators = [];
        if (field.required) {
            validators.push(vmInstance.validators.required);
        }
        let control = vmInstance.fb.control(
            null, {
            validators: validators,
            updateOn: "change"
        });
        if (!vmInstance.addEntityFormGroup.get("thresholdFields")) {
            vmInstance.addEntityFormGroup.addControl("thresholdFields", vmInstance.fb.group({}));
        }
        vmInstance.addEntityFormGroup.get("thresholdFields")
            .addControl(fieldName, control);
        thresholdFields.push(field);
        if ("default" in field && "value" in field.default) {
            vmInstance.addEntityFormGroup.get("thresholdFields")
                .get(field.name).setValue(field.default.value);
        }
    }
    vmInstance.thresholdFields = thresholdFields;
    return thresholdFields;
}

function parseTemplateFields(vmInstance, latestAttributes) {
    const fieldsAttribute = latestAttributes.find(
        latestAttr => latestAttr.key === "fields"
    );
    if (!fieldsAttribute) throw new Error("this chosen template has no fields attribute 😐");
    const fieldsObject = fieldsAttribute.value;
    for (const fieldName in fieldsObject) {
        const exclude = ["displayName", "template"];
        if (exclude.includes(fieldName)) continue;
        // for each key (fieldName) 
        // build validators, control and add to form
        // also push field to vm fields arrays accordingly.
        const field = fieldsObject[fieldName];
        field.name = fieldName;
        if (!("label" in field)) field.label = camelToHuman(
            field.name
        );
        let validators = [];
        if (field.required) {

            validators.push(vmInstance.validators.required);
        }
        let control = vmInstance.fb.control(
            null, {
            validators: validators,
            updateOn: "change"
        });
        if ("specialType" in field) {
            if (field.specialType.startsWith("map")) {
                provisionToMapFormGroup(vmInstance, field, control);
                continue;
            }
            if (field.specialType.startsWith("image")) {
                provisionToImageFormGroup(vmInstance, field, control);
                continue;
            }
            if (field.specialType.startsWith("position")) {
                provisionToFloorPlanGroup(vmInstance, field, control);
                continue;
            };
        }
        if (field.required) {
            vmInstance.addEntityFormGroup.get("fields")
                .addControl(fieldName, control);
            vmInstance.requiredFields.push(field);
            continue;
        }
        if (!vmInstance.addEntityFormGroup.get("additionalFields")) {
            vmInstance.addEntityFormGroup.addControl("additionalFields", vmInstance.fb.group({}));
        }
        vmInstance.addEntityFormGroup.get("additionalFields")
            .addControl(fieldName, control);
        vmInstance.additionalFields.push(field);
    }
    vmInstance.requiredFields.sort(sortByOrder);
    vmInstance.additionalFields.sort(sortByOrder);
}

function provisionToFloorPlanGroup(vmInstance, field, control) {
    if (!vmInstance.addEntityFormGroup.get("positionFields")) {
        vmInstance.addEntityFormGroup.addControl(
            "positionFields",
            vmInstance.fb.group({})
        );
    }
    vmInstance.addEntityFormGroup.get("positionFields")
        .addControl(field.name, control);
    vmInstance.positionFields.push(field);
}

function provisionToImageFormGroup(vmInstance, field, control) {
    if (!vmInstance.addEntityFormGroup.get("imageFields")) {
        vmInstance.addEntityFormGroup.addControl(
            "imageFields",
            vmInstance.fb.group({})
        );
    }
    vmInstance.addEntityFormGroup.get("imageFields")
        .addControl(field.name, control);
    vmInstance.imageFields.push(field);
}
function provisionToMapFormGroup(vmInstance, field, control) {
    if (!vmInstance.addEntityFormGroup.get("mapFields")) {
        vmInstance.addEntityFormGroup.addControl(
            "mapFields",
            vmInstance.fb.group({})
        );
    }
    vmInstance.addEntityFormGroup.get("mapFields")
        .addControl(field.name, control);
    vmInstance.mapFields.push(field);
}

function sortByOrder(a, b) {
    let aOrder = a.order;
    let bOrder = b.order;
    if (!aOrder) aOrder = 99;
    if (!bOrder) bOrder = 99;
    return aOrder - bOrder;
}

function fetchChosenTemplateFields(vmInstance) {
    return attributeService.getEntityAttributes(
        vmInstance.chosenTemplate.id,
        "SERVER_SCOPE",
        ["fields", "thresholds"]
    );
}

function createAsset(vmInstance) {
    const formValues = vmInstance.addEntityFormGroup.value;
    const asset = {
        name: vmInstance.assetName,
        label: formValues.fields.label,
        type: assetProfile, // location, area ...
        customerId: vmInstance.assetOwner // {id, entityType}
    };
    return getEntityGroup(vmInstance.assetOwner).pipe(
        widgetContext.rxjs.switchMap((ownerAssetGroup) => {
            return assetService.saveAsset(asset, ownerAssetGroup.id.id);
        })
    );
}

function getEntityGroup(customer) {
    return entityGroupService
        .getEntityGroupsByOwnerId(
            customer.entityType,
            customer.id,
            "ASSET"
        )
        .pipe(
            widgetContext.rxjs.switchMap((entityGroups) => {
                var entityGroup = entityGroups.find((group) => group.name === assetProfile + "s");
                if (entityGroup) {
                    return widgetContext.rxjs.of(entityGroup);
                } else {
                    entityGroup = {
                        type: "ASSET",
                        name: assetProfile + "s",
                        ownerId: customer,
                    };
                    return entityGroupService.saveEntityGroup(entityGroup);
                }
            })
        );
}