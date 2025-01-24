const assetProfile = "location";
const $injector = widgetContext.$scope.$injector;
const customDialog = $injector.get(widgetContext.servicesMap.get("customDialog"));
const assetService = $injector.get(widgetContext.servicesMap.get("assetService"));
const attributeService = $injector.get(
    widgetContext.servicesMap.get("attributeService")
);
const entityGroupService = $injector.get(widgetContext.servicesMap.get(
    "entityGroupService"
));
const controller = widgetContext.$scope.ctx.stateController;
const params = controller.getStateParams();

openEditAssetDialog();

function openEditAssetDialog() {
    customDialog.customDialog(htmlTemplate, EditAssetDialogController).subscribe();
}

function getEntityAttributes(id, keys) {
    return attributeService.getEntityAttributes(id, "SERVER_SCOPE", keys);
}

function fetchTemplateGroupByName(assetProfile) {
    const pageLink = widgetContext.pageLink(10, 0, assetProfile + "-templates");
    return entityGroupService.getEntityGroupsByPageLink(
        pageLink,
        "ASSET"
    );
}

function getCustomerAttributes(id, keys) {
    return attributeService.getEntityAttributes(id, "SERVER_SCOPE", keys);
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

function EditAssetDialogController(instance) {
    let vm = instance;
    const jwtToken = localStorage.getItem("jwt_token");
    // get entity info in order to
    vm.entityId = entityId;
    vm.entityLabel = entityLabel;
    vm.entityName = entityName;
    vm.assetName = entityName;
    vm.customerCode = "";
    vm.widgetContext = widgetContext;
    // create steps
    vm.isLastStep = false;
    vm.steps = {
        fields: { completed: false },
        additionalFields: { completed: false },
        mapFields: { completed: false },
        imageFields: { completed: false },
        thresholdFields: { completed: false }
    };
    // create fields lists 
    vm.templateFields = [];
    vm.requiredFields = [];
    vm.additionalFields = [];
    vm.mapFields = [];
    vm.imageFields = [];
    vm.thresholdFields = [];

    // get customer attribute customerCode
    const customerId = params.currentCustomer.entityId;
    vm.assetOwner = customerId;
    const customerCodeObservable = getCustomerAttributes(customerId, ["customerCode"]);
    customerCodeObservable.subscribe((data) => vm.customerCode = data[0].value);

    // get assetProfile-templates 
    const templateGroupObservable = fetchTemplateGroupByName(assetProfile);
    const groupEntitiesObservable = templateGroupObservable.pipe(
        widgetContext.rxjs.switchMap((response) => {
            const locationTemplatesGroup = response.data[0];
            return fetchEntitiesFromGroup(locationTemplatesGroup.id.id);
        })
    );

    // get its template attribute in order to
    const entityTemplateObservable = getEntityAttributes(vm.entityId, ["template"]);
    // join paths
    const templateFieldsObservable = widgetContext.rxjs.forkJoin({
        templateAttributeResponse: entityTemplateObservable,
        templatesResponse: groupEntitiesObservable
    }).pipe(
        widgetContext.rxjs.switchMap(({ templateAttributeResponse, templatesResponse }) => {
            // match template
            const templateNameObject = templateAttributeResponse.find(
                (tObject) => tObject.key === "template"
            );
            if (!templateNameObject) throw new Error("could not fetch template for this asset");
            const templateName = templateNameObject.value;
            vm.templateName = templateName.split("-")[0];
            vm.templateLabel = vm.templateName.charAt(0).toUpperCase() + vm.templateName.slice(1);
            const templates = templatesResponse.data;
            const template = templates.find((t) => t.name === templateName);
            if (!template) throw Error(`unrecognized template ${templateName} for this asset ${entityName}`);
            return getEntityAttributes(template.id, ["fields", "thresholds"]);
        })
    );

    // parse fields to get fields, additionalFields, mapFields, imageFields & thresholds
    // build keys list to get such asset attributes
    const entityAttributesObservable = templateFieldsObservable.pipe(
        widgetContext.rxjs.switchMap((templateAttributes) => {
            let attributes = [];
            const fieldsObject = templateAttributes.find((t) => t.key === "fields");
            const thresholdsObject = templateAttributes.find((t) => t.key === "thresholds");
            if (thresholdsObject) {
                vm.thresholdFields = thresholdsObject.value;
                attributes = attributes.concat(Object.keys(vm.thresholdFields));
            }
            if (fieldsObject) {
                vm.templateFields = fieldsObject.value;
                attributes = attributes.concat(Object.keys(vm.templateFields));
            }
            return getEntityAttributes(vm.entityId, attributes);
        })
    );
    entityAttributesObservable.subscribe((latestAttributes) => {
        buildFormBasedOnTemplateFields(vm, latestAttributes);
        buildFormBasedOnThresholds(vm, latestAttributes);
    });

    vm.editAssetFormGroup = vm.fb.group({
        requiredFields: vm.fb.group({
            displayName: ["", [vm.validators.required]],
            label: [vm.entityLabel, [vm.validators.required]],
        })
    });

    vm.onStepChange = function (event, stepper) {
        // check if step is last, if so, save everything
        const steps = stepper.steps.length;
        const currentIndex = stepper.selectedIndex;
        if (currentIndex === steps - 1) {
            vm.save();
        } else {
            stepper.selectedIndex = currentIndex + 1;
        }
    }

    vm.cancel = function () {
        vm.close();
        vm.dialogRef.close(null);
    };

    vm.close = function () {
        vm.entity = null;
        vm.entityId = null;
        vm.entityName = null;
    };

    vm.save = function () {
        const saveAssetObservable = saveAsset(vm);
        const saveRequiredObservable = saveRequiredFields(vm);
        const saveAdditionalObservable = saveFields(vm, "additionalFields");
        const saveImageObservable = saveFields(vm, "imageFields");
        const saveThresholdObservable = saveFields(vm, "thresholdFields");
        widgetContext.rxjs.forkJoin([
            saveAssetObservable,
            saveRequiredObservable,
            saveAdditionalObservable,
            saveImageObservable,
            saveThresholdObservable
        ]).subscribe(() => {
            widgetContext.updateAliases();
            vm.close();
            vm.dialogRef.close(null);
        }, (error) => {
            console.error(">>> 📛 error:", error);
        });
        vm.editAssetFormGroup.markAsPristine();
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
                "location",
                vm.assetOwner.id,
                pageLink
            ).subscribe((response) => {
                const assetWithSameName = response.data.find(
                    assetInfo => assetInfo.name === vm.assetName
                );
                let itself = false;
                if (assetWithSameName.id.id === vm.entityId.id) itself = true;
                if (assetWithSameName && !itself) {
                    vm.editAssetFormGroup.get("requiredFields").get("displayName").setErrors({
                        "notUnique": "Name for location should derive in unique-identifier; try using a different name."
                    });
                    return;
                }
                return;
            });
        } catch (error) {
            console.log(">>> 📛 error:", error);
            return;
        }
    };
}

function replaceAccents(origin) {
    return origin.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

function buildFormBasedOnThresholds(vmInstance, attributes) {
    const thresholdsObject = vmInstance.thresholdFields;
    for (const thresholdName in thresholdsObject) {
        const field = thresholdsObject[thresholdName];
        field.name = thresholdName;
        if (!("label" in field)) field.label = camelToHuman(
            field.name
        );
        let validators = [];
        if (field.required) {
            validators.push(vmInstance.validators.required);
        }
        // get initial value
        let attributeLatestValue;
        let attributeLatestObject = attributes.find((a) => a.key === field.name);
        if (attributeLatestObject) {
            attributeLatestValue = attributeLatestObject.value;
        } else {
            if ("default" in field) {
                attributeLatestValue = field.default.value;
            } else {
                attributeLatestValue = "";
            }
        }
        let control = vmInstance.fb.control(
            attributeLatestValue, {
            validators: validators,
            updateOn: "change"
        });
        if (!vmInstance.editAssetFormGroup.get("thresholdFields")) {
            vmInstance.editAssetFormGroup.addControl("thresholdFields", vmInstance.fb.group({}));
        }
        vmInstance.editAssetFormGroup.get("thresholdFields")
            .addControl(fieldName, control);
        vmInstance.thresholdFields.push(field);
    }
}

function buildFormBasedOnTemplateFields(vmInstance, attributes) {
    const fieldsObject = vmInstance.templateFields;
    for (const fieldName in fieldsObject) {
        // ignore template
        const exclude = ["template"];
        if (exclude.includes(fieldName)) continue;
        const field = fieldsObject[fieldName];
        field.name = fieldName;
        // get initial value
        let attributeLatestValue;
        let attributeLatestObject = attributes.find((a) => a.key === fieldName);
        if (attributeLatestObject) {
            attributeLatestValue = attributeLatestObject.value;
        } else {
            if ("default" in field) {
                attributeLatestValue = field.default.value;
            } else {
                attributeLatestValue = "";
            }
        }
        if (field.name === "displayName") {
            vmInstance.editAssetFormGroup.get("requiredFields")
                .get(field.name).setValue(attributeLatestValue);
            continue;
        }
        if (!("label" in field)) field.label = camelToHuman(
            field.name
        );
        let validators = [];
        if (field.required) {
            validators.push(vmInstance.validators.required);
        }
        let control = vmInstance.fb.control(
            attributeLatestValue, {
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
        }
        if (field.required) {
            vmInstance.editAssetFormGroup.get("requiredFields")
                .addControl(field.name, control);
            vmInstance.requiredFields.push(field);
            continue;
        }
        if (!vmInstance.editAssetFormGroup.get("additionalFields")) {
            vmInstance.editAssetFormGroup.addControl("additionalFields", vmInstance.fb.group({}));
        }
        vmInstance.editAssetFormGroup.get("additionalFields")
            .addControl(field.name, control);
        vmInstance.additionalFields.push(field);
    }
}

function buildAssetName(vmInstance) {
    if (!vmInstance.customerCode) throw new Error("no customer code for curent customer 😐");
    let assetName = vmInstance.customerCode + "-" + vmInstance.templateName;
    const currentDisplayName = vmInstance.editAssetFormGroup.get("requiredFields").get("displayName").value;
    if (currentDisplayName != "") assetName += "-" + humanToKebab(currentDisplayName);
    let uniqueHash;
    if (entityName && entityName.startsWith(assetName.slice(0, 8))) {
        uniqueHash = entityName.slice(-9);
    } else {
        uniqueHash = "-" + Math.floor(Math.random() * 0xffffff).toString(16).padEnd(8, "0");
    }
    assetName = assetName.slice(0, 36); // so that names are the same length as tb ids.
    assetName += uniqueHash; // asset name length + 9 chars...
    return assetName;
}

function provisionToImageFormGroup(vmInstance, field, control) {
    if (!vmInstance.editAssetFormGroup.get("imageFields")) {
        vmInstance.editAssetFormGroup.addControl(
            "imageFields",
            vmInstance.fb.group({})
        );
    }
    vmInstance.editAssetFormGroup.get("imageFields")
        .addControl(field.name, control);
    vmInstance.imageFields.push(field);
}

function provisionToMapFormGroup(vmInstance, field, control) {
    if (!vmInstance.editAssetFormGroup.get("mapFields")) {
        vmInstance.editAssetFormGroup.addControl(
            "mapFields",
            vmInstance.fb.group({})
        );
    }
    vmInstance.editAssetFormGroup.get("mapFields")
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

function saveAsset(vmInstance) {
    const formValues = vmInstance.editAssetFormGroup.get("requiredFields").value;
    const asset = {};
    asset.name = vmInstance.assetName;
    asset.label = formValues.label;
    asset.id = vmInstance.entityId;
    asset.customerId = vmInstance.assetOwner;
    asset.type = assetProfile;
    return assetService.saveAsset(asset);
}

function saveRequiredFields(vmInstance) {
    const fields = vmInstance.requiredFields.filter(
        (field) => !["template", "label"].includes(field.name)
    );
    const controls = vmInstance.editAssetFormGroup.get("requiredFields").controls;
    const fieldValues = vmInstance.editAssetFormGroup.get("requiredFields").value;
    const attributes = [];
    if (controls.displayName.dirty) {
        attributes.push({
            key: "displayName",
            value: fieldValues["displayName"]
        });
    }
    for (const field of fields) {
        const key = field.name;
        if (key in fieldValues && controls[key].dirty) {
            attributes.push({
                key: key,
                value: fieldValues[key]
            });
        }
    }
    if (attributes.length == 0) return widgetContext.rxjs.of([]);
    return attributeService.saveEntityAttributes(
        vmInstance.entityId,
        "SERVER_SCOPE",
        attributes
    );
}

function saveFields(vmInstance, formGroupName) {
    let fields = vmInstance[formGroupName];
    const attributes = [];
    const fieldValues = {};
    let controls;
    if (vmInstance.editAssetFormGroup.get(formGroupName)) {
        Object.assign(
            fieldValues,
            vmInstance.editAssetFormGroup.get(formGroupName).value
        );
        controls = vmInstance.editAssetFormGroup.get(formGroupName).controls;
    }
    for (const field of fields) {
        const key = field.name;
        if (key in fieldValues && controls && controls[key].dirty) {
            attributes.push({
                key: key,
                value: fieldValues[key]
            });
        }
    }
    if (attributes.length == 0) return widgetContext.rxjs.of([]);
    return attributeService.saveEntityAttributes(
        vmInstance.entityId,
        "SERVER_SCOPE",
        attributes
    );
}
