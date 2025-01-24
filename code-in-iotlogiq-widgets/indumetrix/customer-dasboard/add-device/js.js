const assetProfile = "machine";
const currentUserId = widgetContext.currentUser.userId;
const $injector = widgetContext.$scope.$injector;
const rxjs = widgetContext.rxjs;
const customDialog = $injector.get(widgetContext.servicesMap.get("customDialog"));
const assetService = $injector.get(widgetContext.servicesMap.get("assetService"));
const deviceService = $injector.get(widgetContext.servicesMap.get("deviceService"));
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
console.log(">>> 💛", widgetContext, attributeService);
openAddEntityDialog();

function camelToPascal(input) {
    return input.charAt(0).toUpperCase() + input.slice(1);
}

function camelToHuman(input) {
    return camelToPascal(input).split(/(?=[A-Z])/).join(" ");
}

function parseManufacturersAndModelsFromTemplates(templates) {
    const result = {};
    for (const template of templates) {
        const devices = template.deviceModels;
        for (const device of devices) {
            const manufacturer = device.manufacturer;
            const model = device.model;
            if (!(manufacturer in result)) result[manufacturer] = {
                label: camelToHuman(manufacturer),
                models: {}
            };
            if (!(model in result[manufacturer].models)) result[manufacturer]
                .models[model] = {
                label: model.toUpperCase(),
                value: model
            };
        }
    }
    const manufacturers = [];
    for (const name in result) {
        const manufacturer = result[name];
        manufacturers.push({
            label: manufacturer.label,
            value: name,
            models: Object.values(manufacturer.models)
        });
    }
    return manufacturers;
}

function AddEntityDialogController(instance) {
    let vm = instance;
    vm.ENTER = 13;
    vm.COMMA = 188;
    vm.template;
    vm.templateNotFound;
    vm.customer = params.currentCustomer;
    vm.currentLocation = params.currentLocation;
    vm.deviceName = null;
    vm.deviceNameNotUnique;
    vm.matchingTemplates = [];
    // set up fields arrays
    vm.manufacturers = [];
    vm.models = [];
    vm.requiredFields = [];
    vm.additionalFields = [];
    vm.positionFields = [];
    vm.provisioningFields = [];
    vm.configurationFields = [];
    vm.thresholdFields = [];
    vm.devEUIValidator = validateDevEUI;
    // set up device templates
    const deviceTemplatesObservable = getDeviceTemplatesObservable(vm);
    // fill out select options
    deviceTemplatesObservable.subscribe((response) => {
        vm.templates = response;
        vm.manufacturers = parseManufacturersAndModelsFromTemplates(
            vm.templates
        );
    });
    // set up form with basic fields for all devices
    const basicForm = vm.fb.group({
        devEUI: [null, {
            validators: [vm.validators.required, vm.devEUIValidator],
            updateOn: "change"
        }],
        label: [null, {
            validators: [vm.validators.required],
            updateOn: "change"
        }],
        manufacturer: [null, {
            validators: [vm.validators.required],
            updateOn: "change"
        }],
        model: [null, {
            validators: [vm.validators.required],
            updateOn: "change"
        }],
        template: [null, {
            validators: [vm.validators.required],
            updateOn: "change"
        }]
    });
    vm.addEntityFormGroup = vm.fb.group({
        basic: basicForm,
        provisioningChoice: vm.fb.group({
            lns: [null, [vm.validators.required]],
            lnsVendor: [null, [vm.validators.required]],
            lnsModel: [null, [vm.validators.required]]
        }),
        provisioningFields: vm.fb.group({})
    });
    vm.cancel = function () {
        vm.entity = null;
        vm.entityId = null;
        vm.entityName = null;
        vm.dialogRef.close(null);
    };
    vm.skip = function (stepper) {
        vm.nextStepOrClose(stepper);
    };
    vm.onModelChange = function (event) {
        // show templateOptions
        const matchingTemplates = findMatchingTemplates(
            vm.templates,
            vm.addEntityFormGroup.get("basic").value
        );
        vm.matchingTemplates = matchingTemplates;
    };
    vm.checkBasicData = function (vmInstance) {
        const controls = vm.addEntityFormGroup.get("basic").controls;
        if (!isFormValid(controls)) return;
        // buld device name
        const formValues = vm.addEntityFormGroup.get("basic").value;
        vm.deviceName = buildDeviceName(
            formValues.manufacturer,
            formValues.model,
            formValues.devEUI
        );
        // check if asset name is unique
        getCustomerDevicesObservable(
            vm.customer,
            vm.deviceName
        ).subscribe((results) => {
            if (results.length > 0) vm.deviceNameNotUnique = true;
            else vm.deviceNameNotUnique = false;
        });
        // check if model belongs to any device template
        // const template = findMatchingTemplate(vm.templates, formValues);
        const template = formValues.template;
        vm.template = template;
        vm.templateNotFound = template === undefined;
        parseFieldsFromTemplate(vm);
    };
    vm.save = function (stepper, mode, formGroupName = "basic") {

        const controls = vm.addEntityFormGroup.get(formGroupName).controls;
        if (!isFormValid(controls)) {
            stepper.selectedIndex = stepper.previouslySelectedIndex;
            return;
        }
        if (mode === "create") {
            createDeviceObservable(vm).pipe(
                rxjs.switchMap((response) => {
                    if (response && "error" in response) throw response.error;
                    return getCredentialAssetsObservable();
                })
            ).subscribe((credentials) => {
                if ("error" in credentials) return;
                vm.availableLNS = credentials;
                stepper.selectedIndex = stepper.selectedIndex + 1;
            });
        } else {
            let provisioningObservable = rxjs.of({});
            if (formGroupName === "provisioningFields") {
                const choices = vm.addEntityFormGroup.get("provisioningChoice").value;
                const attributes = [];
                for (const fieldName in choices) {
                    let value = choices[fieldName];
                    if (fieldName === "lns") value = value.name;
                    attributes.push({
                        key: fieldName,
                        value: value
                    });
                }
                provisioningObservable = attributeService.saveEntityAttributes(
                    vm.entityId,
                    "SERVER_SCOPE",
                    attributes
                ).pipe(
                    rxjs.switchMap(() => attributeService.saveEntityAttributes(
                        vm.entityId,
                        "SERVER_SCOPE",
                        [{ key: "registerToLNS", value: true }]
                    )),
                    rxjs.tap(() => {
                        const lnsLabel = vm.addEntityFormGroup.get("provisioningChoice").value.lns.label;
                        vm.lnsRegistrationResult = {
                            type: "success",
                            msg: "Device " + vm.deviceName + " was registered successfully to " + lnsLabel + "."
                        };
                    }),
                    rxjs.catchError((error) => {
                        vm.lnsRegistrationResult = {
                            type: "error",
                            msg: error
                        };
                        return rxjs.of({ error: error });
                    })
                );
                vm.showResultsStep = true;
            }
            const saveObservable = saveFields(
                vm,
                vm.entityId.id,
                formGroupName
            ).pipe(
                rxjs.switchMap(() => provisioningObservable)
                // rxjs.tap(() => {
                //     const lnsLabel = vm.addEntityFormGroup.get("provisioningChoice").value.lns.label;
                //     vm.lnsRegistrationResult = {
                //         type: "success",
                //         msg: "Device " + vm.deviceName + " was registered successfully to " + lnsLabel + "."
                //     };
                // }),
                // rxjs.catchError((error) => {
                //     vm.lnsRegistrationResult = {
                //         type: "error",
                //         msg: error
                //     };
                //     return rxjs.of({error: error});
                // })
            );
            saveObservable.subscribe((response) => {
                // if ("error" in response) throw new Error(response.error);
                vm.nextStepOrClose(stepper);
            });
        }
    };
    vm.nextStepOrClose = function (stepper) {
        // figure out if next step?
        if (stepper && stepper._steps.length - 1 > stepper.selectedIndex) {
            stepper.selectedIndex = stepper.selectedIndex + 1;
        } else vm.cancel();
    };
    vm.onManufacturerChange = function (event) {
        for (const manufacturer of vm.manufacturers) {
            if (manufacturer.value === event.value) {
                vm.models = manufacturer.models;
                return;
            }
        }
        vm.models = [];
    };
    vm.onLNSVendorChange = function (event) {
        clearLNSChoices(vm, ["lnsModel"]);
        const lns = vm.addEntityFormGroup.get("provisioningChoice").value.lns;
        attributeService.getEntityAttributes(
            lns.id,
            "SERVER_SCOPE",
            [event.value.id]
        ).pipe(
            rxjs.switchMap((response) => response[0].value),
            rxjs.map((model) => {
                const bands = model.ismBands;
                const details = bands.map((band) => band.ID).join(", ");
                model.label = `${model.name} (${details})`;
                return model;
            }),
            rxjs.toArray()
        ).subscribe((models) => vm.lnsModels = models);
    };
    vm.onLNSChange = function (event) {
        clearLNSChoices(vm, ["lnsModel", "lnsVendor"]);
        if (!event.value.provider) return;
        const provider = event.value.provider;
        if (provider === "thingpark") {
            // bring up vendors and then models...
            vm.lnsVendors = event.value.vendors.map((vendor) => {
                vendor.label = vendor.name;
                return vendor;
            });
            // parse chosen lns provisioningFields into provisioningFields
            vm.provisioningFields = parseLNSProvisioningFields(vm, event.value);
            return;
        }
        // other providers
        throw new Error(`>>> 📛 error: unknown lns provider: ${event.value.provider} 😐`);
    };
    vm.addChip = function (event, formGroupName, fieldName) {
        const currentChips = vm.addEntityFormGroup
            .get(formGroupName)
            .get(fieldName)
            .value;
        const newValue = event.value.trim();
        if (!newValue) return;
        currentChips.push(newValue);
        vm.addEntityFormGroup
            .get(formGroupName)
            .get(fieldName)
            .setValue(currentChips);
        event.chipInput.clear();
    };
    vm.editChip = function (event, chip, formGroupName, fieldName) {
        const currentChips = vm.addEntityFormGroup
            .get(formGroupName)
            .get(fieldName)
            .value;
        const editedChips = [];
        const newValue = event.value.trim();
        for (const _chip of currentChips) {
            if (chip === _chip) {
                if (!newValue) continue;
                editedChips.push(newValue);
                continue;
            }
            editedChips.push(_chip);
        }
        vm.addEntityFormGroup
            .get(formGroupName)
            .get(fieldName)
            .setValue(editedChips);
    };
    vm.removeChip = function (chip, formGroupName, fieldName) {
        const currentChips = vm.addEntityFormGroup
            .get(formGroupName)
            .get(fieldName)
            .value;
        vm.addEntityFormGroup
            .get(formGroupName)
            .get(fieldName)
            .setValue(currentChips.filter(_chip => _chip !== chip));
    };
}

function validateDevEUI(control) {
    const hexRegex = /^[a-fA-F0-9]+$/;
    if (hexRegex.test(control.value) && control.value.length === 16) return null;
    return {
        invalidDevEUI: true
    };
}

function clearLNSChoices(vmInstance, controlNames) {
    for (const name of controlNames) {
        const items = name + "s";
        vmInstance[items] = [];
        vmInstance.addEntityFormGroup.get("provisioningChoice").get(name).setValue(null);
    }
}

function findMatchingTemplates(templates, formValues) {
    const chosenTemplates = [];
    for (const template of templates) {
        for (const deviceModel of template.deviceModels) {
            const manufacturer = parseManufacturer(formValues.manufacturer);
            const model = parseModel(formValues.model);
            if (
                deviceModel.manufacturer.toLowerCase() === manufacturer.toLowerCase() &&
                deviceModel.model.toLowerCase() === model.toLowerCase()
            ) {
                chosenTemplates.push(template);
                break;
            }
        }
    }
    return chosenTemplates;
}

function findMatchingTemplate(templates, formValues) {
    let chosenTemplate;
    for (const template of templates) {
        for (const deviceModel of template.deviceModels) {
            const manufacturer = parseManufacturer(formValues.manufacturer);
            const model = parseModel(formValues.model);
            if (
                deviceModel.manufacturer.toLowerCase() === manufacturer.toLowerCase() &&
                deviceModel.model.toLowerCase() === model.toLowerCase()
            ) {
                chosenTemplate = template;
                break;
            }
        }
        if (chosenTemplate) break;
    }
    return chosenTemplate;
}

function isFormValid(controls) {
    let valid = true;
    for (let fieldName in controls) {
        controls[fieldName].markAsTouched();
        if (!controls[fieldName].valid) valid = false;
    }
    return valid;
}



function parseLNSProvisioningFields(vmInstance, lns) {
    if (!vmInstance.addEntityFormGroup.get("provisioningFields")) {
        vmInstance.addEntityFormGroup
            .addControl("provisioningFields", vmInstance.fb.group({}));
    }
    const connections = lns.connections.map((connection) => {
        connection.label = connection.name;
        return connection;
    });
    if (!lns.domains) lns.domains = [];
    const domains = lns.domains.map((domain) => {
        domain.label = `${domain.name}:${domain.group.name}`;
        return domain;
    })
    const fields = [];
    for (var fieldName in lns.provisioning) {
        const field = lns.provisioning[fieldName];
        field.name = fieldName;
        if (!("label" in field)) field.label = camelToHuman(
            field.name
        );
        if (field.hide) continue;
        if (field.type === "json" && field.input === "multi-select") {
            const options = [];
            if (field.name === "lnsConnections") {
                field.options = connections;
            }
            if (field.name === "lnsDomains") {
                field.options = domains;
            }
        }
        let validators = [];
        if (field.required) {
            validators.push(vmInstance.validators.required);
        }
        let control = vmInstance.fb.control(
            null, {
            validators: validators,
            updateOn: "change"
        });
        vmInstance.addEntityFormGroup.get("provisioningFields").addControl(fieldName, control);
        fields.push(field);
        if ("default" in field && "value" in field.default) {
            vmInstance.addEntityFormGroup.get("provisioningFields")
                .get(field.name).setValue(field.default.value);
        }
    }
    vmInstance.provisioningFields = fields;
    return fields;
}

function parseFieldsFromTemplate(vmInstance) {
    if (!vmInstance.template) {
        vmInstance.requiredFields = [];
        vmInstance.additionalFields = [];
        vmInstance.positionFields = [];
        vmInstance.configurationFields = [];
        vmInstance.thresholdFields = [];
        return;
    }
    parseDeviceTemplateRequiredFields(vmInstance, [{
        key: "requiredFields",
        value: vmInstance.template.fields
    }]);
    parseDeviceTemplateFields(
        vmInstance,
        vmInstance.template.thresholds,
        "thresholdFields"
    );
}

function openAddEntityDialog() {
    customDialog.customDialog(htmlTemplate, AddEntityDialogController).subscribe();
}

function createDeviceObservable(vmInstance) {
    return getEntityGroup(
        vmInstance.customer.entityId
    ).pipe(
        // create device based on label, entityName, type
        rxjs.switchMap((devicesGroup) => {
            const label = vmInstance.addEntityFormGroup.get("basic").get("label").value;
            const device = {
                name: vmInstance.deviceName,
                label: label,
                type: vmInstance.template.type,
                customerId: vmInstance.customer.entityId
            };
            return deviceService.saveDevice(
                device,
                devicesGroup.id.id
            );
        }),
        // assign entity to widgetContext
        rxjs.tap((newDevice) => {
            vmInstance.entity = newDevice;
            vmInstance.entityId = newDevice.id;
            vmInstance.entityName = newDevice.name;
        }),
        // update attributes for template, model, manufacturer & devEUI
        rxjs.switchMap((newDevice) => {
            const formValues = vmInstance.addEntityFormGroup.get("basic").value;
            const attributes = [];
            const payload = {
                template: vmInstance.template.name,
                manufacturer: parseManufacturer(formValues.manufacturer),
                deviceModel: parseModel(formValues.model),
                devEUI: formValues.devEUI.toUpperCase()
            };
            for (const key in payload) {
                attributes.push({
                    key: key,
                    value: payload[key]
                });
            }
            return attributeService.saveEntityAttributes(
                newDevice.id,
                "SERVER_SCOPE",
                attributes
            ).pipe(
                rxjs.switchMap(function () {
                    return entityRelationService.saveRelation({
                        from: vmInstance.currentLocation.entityId,
                        to: newDevice.id,
                        type: "Contains",
                        typeGroup: "COMMON"
                    });
                })
            );
        }),
        rxjs.catchError((error) => {
            console.error(">>> 📛 error:", error);
            return rxjs.of({
                error: error
            });
        })
    );
}

function getCredentialAssetsObservable() {
    const groupsPageLink = widgetContext.pageLink(10, 0, "lns-credentials");
    return entityGroupService.getEntityGroupsByPageLink(
        groupsPageLink,
        "ASSET"
    ).pipe(
        rxjs.switchMap((response) => {
            const pageLink = widgetContext.pageLink(100, 0);
            const group = response.data[0];
            return entityGroupService.getEntityGroupEntities(
                group.id.id,
                pageLink,
                null,
                {},
                "ASSET"
            );
        }),
        rxjs.switchMap((response) => {
            const credentialAssets = response.data;
            return rxjs.from(credentialAssets).pipe(
                rxjs.concatMap((credential) => assetService
                    .getAssetInfo(credential.id.id)
                )
            );
        }),
        rxjs.concatMap((credentialAsset) => {
            return attributeService.getEntityAttributes(
                credentialAsset.id,
                "SERVER_SCOPE",
                [
                    "baseURL",
                    "clientId",
                    "clientSecret",
                    "provider",
                    "provisioning",
                    "endpoints",
                    "connections",
                    "domains",
                    "vendors"
                ]
            ).pipe(
                rxjs.map((attributes) => {
                    for (const attr of attributes) {
                        credentialAsset[attr.key] = attr.value;
                    }
                    return credentialAsset;
                })
            )
        }),
        rxjs.toArray()
    );
}

function getDeviceTemplatesObservable() {
    const groupsPageLink = widgetContext.pageLink(10, 0, "device-templates");
    return entityGroupService.getEntityGroupsByPageLink(
        groupsPageLink,
        "DEVICE"
    ).pipe(
        rxjs.switchMap((response) => {
            const templatesPageLink = widgetContext.pageLink(100, 0);
            const group = response.data[0];
            return entityGroupService.getEntityGroupEntities(
                group.id.id,
                templatesPageLink,
                null,
                {},
                "DEVICE"
            );
        }),
        rxjs.switchMap((response) => {
            const templates = response.data;
            return rxjs.from(templates).pipe(
                rxjs.concatMap((template) => deviceService
                    .getDevice(template.id.id)
                )
            );
        }),
        rxjs.concatMap((deviceTemplate) => {
            return attributeService.getEntityAttributes(
                deviceTemplate.id,
                "SERVER_SCOPE",
                ["fields", "configuration", "thresholds", "deviceModels"]
            ).pipe(
                rxjs.map((attributes) => {
                    const name = deviceTemplate.name.replace("-template", "");
                    const label = kebabToHuman(name);
                    deviceTemplate.label = label;
                    for (const attr of attributes) {
                        deviceTemplate[attr.key] = attr.value;
                    }
                    return deviceTemplate;
                })
            );
        }),
        rxjs.toArray()
    );
}

function buildDeviceName(manufacturer, model, devEUI) {
    // Manufacturer-MODEL-shortDevEUI
    manufacturer = parseManufacturer(manufacturer);
    model = parseModel(model);
    // manufacturer = manufacturer.toLowerCase();
    // manufacturer = manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1);
    // model = model.replaceAll(/[^a-zA-Z0-9]/g, "").toUpperCase();
    let shortDevEUI = devEUI.slice(-6).toUpperCase();
    const deviceName = `${manufacturer}-${model}-${shortDevEUI}`;
    return deviceName;
}

function parseModel(model) {
    return model.replaceAll(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function parseManufacturer(manufacturer) {
    return manufacturer.charAt(0).toUpperCase() + manufacturer.slice(1).toLowerCase();
}

function getCustomerDevicesObservable(customer, deviceName) {
    const pageLink = widgetContext.pageLink(10, 0, deviceName);
    return deviceService.getCustomerDevices(
        customer.entityId.id,
        pageLink
    ).pipe(
        rxjs.map((response) => response.data)
    );
}

function getCustomerAttributes(id, keys) {
    return attributeService.getEntityAttributes(id, "SERVER_SCOPE", keys);
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

function saveRequiredFields(vmInstance, deviceId) {
    const fields = vmInstance.requiredFields;
    const fieldValues = vmInstance.addEntityFormGroup.get("requiredFields").value;
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
    return deviceService.saveEntityAttributes(
        deviceId,
        "SERVER_SCOPE",
        attributes
    );
}

function saveFields(vmInstance, deviceId, formGroupName) {
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
        id: deviceId,
        entityType: "DEVICE"
    }, "SERVER_SCOPE",
        attributes
    ).pipe(
        rxjs.catchError((error) => {
            console.error(">>> 📛 error:", error);
            return { error: error };
        })
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

function fetchEntitiesFromGroup(groupId) {
    const pageLink = widgetContext.pageLink(100, 0);
    return entityGroupService.getEntityGroupEntities(
        groupId,
        pageLink,
        null,
        {},
        "DEVICE"
    );
}

function fetchTemplateGroupByName() {
    const pageLink = widgetContext.pageLink(10, 0, "device-templates");
    return entityGroupService.getEntityGroupsByPageLink(
        pageLink,
        "DEVICE"
    );
}

function parseDeviceTemplateFields(vmInstance, fieldsObject, formGroupName) {
    const fields = [];
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
        if (!vmInstance.addEntityFormGroup.get(formGroupName)) {
            vmInstance.addEntityFormGroup.addControl(formGroupName, vmInstance.fb.group({}));
        }
        vmInstance.addEntityFormGroup.get(formGroupName)
            .addControl(fieldName, control);
        fields.push(field);
        if ("default" in field && "value" in field.default) {
            vmInstance.addEntityFormGroup.get(formGroupName)
                .get(field.name).setValue(field.default.value);
        }
    }
    vmInstance[formGroupName] = fields;
    return fields;
}

function parseDeviceTemplateRequiredFields(vmInstance, latestAttributes) {
    const fieldsAttribute = latestAttributes.find(
        latestAttr => latestAttr.key === "requiredFields"
    );
    if (!fieldsAttribute) throw new Error("this chosen template has no fields attribute 😐");
    const fieldsObject = fieldsAttribute.value;
    for (const fieldName in fieldsObject) {
        const exclude = [
            "devEUI",
            "template",
            "manufacturer",
            "model",
            "operativeStatus",
            "administrativeStatus"
        ];
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
            if (field.specialType.startsWith("position")) {
                provisionToFloorPlanGroup(vmInstance, field, control);
                continue;
            };
        }
        if (field.required) {
            vmInstance.addEntityFormGroup.get("requiredFields")
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
            "DEVICE"
        ).pipe(
            rxjs.switchMap((entityGroups) => {
                var entityGroup = entityGroups.find((group) => group.name === "devices");
                if (entityGroup) {
                    return rxjs.of(entityGroup);
                } else {
                    entityGroup = {
                        type: "DEVICE",
                        name: "devices",
                        ownerId: customer,
                    };
                    return entityGroupService.saveEntityGroup(entityGroup);
                }
            })
        );
}
