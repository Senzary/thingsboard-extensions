const assetProfile = "area";
const $injector = widgetContext.$scope.$injector;
const stateController = widgetContext.$scope.ctx.stateController;
const rxjs = widgetContext.rxjs;
const dialogs = $injector.get(widgetContext.servicesMap.get("dialogs"));
const customDialog = $injector.get(widgetContext.servicesMap.get("customDialog"));
const assetService = $injector.get(widgetContext.servicesMap.get("assetService"));
const attributeService = $injector.get(widgetContext.servicesMap.get("attributeService"));
const deviceService = $injector.get(widgetContext.servicesMap.get("deviceService"));
const entityGroupService = $injector.get(widgetContext.servicesMap
    .get("entityGroupService"));
const entityRelationService = $injector.get(widgetContext.servicesMap
    .get("entityRelationService"));
const subscriptions = [];

openBulkImportDialog();

function BulkImportAssetController(instance) {
    const vm = instance;
    vm.assetProfile = assetProfile;
    vm.template = null;
    vm.templates = [];
    // set customer from dashboard state
    const params = stateController.getStateParams();
    if (!("currentCustomer" in params)) throw new Error(
        "must choose a customer first 😐"
    );
    vm.customer = params.currentCustomer;
    vm.customerCode;
    vm.currentUser = widgetContext.currentUser;
    const customerCodeObservable = getEntityAttributes(
        vm.customer.entityId,
        ["customerCode"]
    );
    customerCodeObservable.subscribe((data) => {
        vm.customerCode = data[0].value;
        return getEntityGroup(vm.customer.entityId)
            .subscribe((ownerAssetGroup) => vm.ownerAssetGroup = ownerAssetGroup);
    });

    // set location
    const location = params.currentLocation;
    vm.locationObject = location;
    vm.locationId = location.entityId;

    // load assetProfile template group and entities
    const templatesObservable = fetchGroupByName(
        `${assetProfile}-templates`,
        "ASSET"
    ).pipe(
        rxjs.switchMap((response) => fetchEntitiesFromGroup(
            response.data[0].id.id,
            "ASSET"
        )),
        rxjs.map((response) => response.data),
        rxjs.switchMap((templates) => rxjs.from(templates).pipe(rxjs.concatMap(
            (template) => assetService.getAssetInfo(template.id.id)
        ))),
        rxjs.map((assetInfo) => {
            const templateName = assetInfo.name.replace(`-${assetProfile}-template`, "");
            assetInfo.templateName = templateName;
            assetInfo.optionLabel = kebabToHuman(templateName);
            return assetInfo;
        }),
        rxjs.toArray(),
        rxjs.tap((templateInfos) => { vm.templates = templateInfos })
    );
    const templatesSubscription = templatesObservable.subscribe();
    subscriptions.push(templatesSubscription);

    // have the user choose a template in order to
    // build initial form
    vm.bulkImportFormGroup = vm.fb.group({
        inputFile: vm.fb.group({
            template: ["", [vm.validators.required]],
            file: [null, [vm.validators.required]]
        }),
        validation: vm.fb.group({
            // validate: [null, [vm.validators.required]]
        }),
        results: vm.fb.group({})
    });
    vm.formValues = vm.bulkImportFormGroup.value;
    const templateSubscription = vm.bulkImportFormGroup
        .get("inputFile.template")
        .valueChanges
        .subscribe((value) => {
            vm.template = value;
            // fecth chosen template fields
            const templateId = value.id;
            const templateFieldsSubscription = getEntityAttributes(
                templateId,
                ["fields", "thresholds"]
            ).subscribe((latestAttributes) => {
                vm.templateFields = parseTemplateFields(latestAttributes, vm);
                vm.thresholdFields = parseTemplateThresholds(latestAttributes, vm);
                vm.csvFieldsList = vm.templateFields.map(
                    (field) => {
                        let label = field.label;
                        if (field.required) label += "*";
                        return label;
                    }
                ).concat(vm.thresholdFields.map(
                    (field) => {
                        let label = field.label;
                        if (field.required) label += "*";
                        return label;
                    }
                ));
                vm.csvExamplesList = vm.templateFields.map(
                    (field) => {
                        if ("example" in field) return field.example;
                        return field.label;
                    }
                ).concat(vm.thresholdFields.map(
                    (field) => {
                        if ("example" in field) return field.example;
                        return field.label;
                    }
                ));
            });
            subscriptions.push(templateFieldsSubscription);
        });
    subscriptions.push(templateSubscription);

    vm.onTemplateChange = function (event) {
        if (!event.value) vm.template = null;
        vm.template = event.value;
    };

    // have the user upload the csv file
    vm.onSelectionChange = function (event) {
        if (event.selectedIndex == 1) {
            validateUploadedFile(vm).pipe(
                rxjs.toArray()
            ).subscribe((items) => {
                const results = [];
                const errors = [];
                for (const item of items) {
                    if (item.error) errors.push(item);
                    else results.push(item);
                }
                vm.resultColumns = ["line", "displayName", "label"];
                vm.results = results;
                vm.errorColumns = ["line", "error"];
                vm.errors = errors;
            });
        } else if (event.selectedIndex == 2) {
            createAllAssets(vm).pipe(
                rxjs.toArray()
            ).subscribe((successes) => {
                vm.successes = successes;
            });
        }
    };

    vm.cancel = function () {
        widgetContext.updateAliases();
        subscriptions.forEach(sub => sub.unsubscribe());
        vm.dialogRef.close(null);
    };
}

function createAllAssets(vmInstance) {
    // have user click on create and create all this assets
    const assetsData = vmInstance.results;
    vmInstance.successes = [];
    vmInstance.successColumns = ["line", "displayName", "entityId"];
    vmInstance.errorsOnCreate = [];
    vmInstance.errorsOnCreateColumns = ["line", "error"];
    return rxjs.from(assetsData).pipe(
        rxjs.concatMap((assetData) => {
            // create asset
            const asset = {
                name: assetData.entityName,
                label: assetData.label,
                type: assetProfile,
                customerId: vmInstance.customer.entityId
            };
            const createAssetObservable = assetService.saveAsset(
                asset,
                vmInstance.ownerAssetGroup.id.id
            );
            return createAssetObservable.pipe(
                rxjs.switchMap((newAsset) => {
                    // Save the areaToLocation relationship
                    const areaToLocationObservable = entityRelationService.saveRelation({
                        from: vmInstance.locationId,
                        to: newAsset.id,
                        type: "areaToLocation",
                        typeGroup: "COMMON",
                    });
                    // Save the accessToArea relationship
                    const accessToAreaObservable = entityRelationService.saveRelation({
                        to: {
                            id: vmInstance.currentUser.userId,
                            entityType: "USER",
                        },
                        from: newAsset.id,
                        type: "accessToArea",
                        additionalInfo: {
                            addedOn: "bulk asset import."
                        }
                    });
                    // save required attributes
                    const saveAttributesObservable = saveRequiredFields(
                        vmInstance,
                        newAsset.id.id,
                        assetData
                    );
                    // Use forkJoin to combine the saveRelation observables
                    return rxjs
                        .forkJoin([
                            areaToLocationObservable,
                            accessToAreaObservable,
                            saveAttributesObservable,
                            rxjs.of([newAsset])
                        ]);
                }),
                rxjs.switchMap((responses) => {
                    const newAsset = responses[3][0];
                    const additionalFieldsObservable = saveFields(
                        vmInstance,
                        newAsset.id.id,
                        "additionalFields",
                        assetData
                    );
                    const mapFieldsObservable = saveFields(
                        vmInstance,
                        newAsset.id.id,
                        "mapFields",
                        assetData
                    );
                    return rxjs.forkJoin([
                        additionalFieldsObservable,
                        mapFieldsObservable,
                        rxjs.of([newAsset])
                    ]);
                }),
                rxjs.map((responses) => responses[2][0]),
                rxjs.map((readyAsset) => {
                    const success = Object.assign({}, assetData);
                    success.id = readyAsset.id.id;
                    return success;
                }),
                rxjs.catchError((error) => {
                    const errorData = Object.assign({}, assetData);
                    errorData.error = error;
                    vmInstance.errorsOnCreate.push(errorData);
                })
            );
        })
    );
}

function saveRequiredFields(vmInstance, assetId, fieldValues) {
    const fields = vmInstance.requiredFields.filter(
        (field) => !["template", "label"].includes(field.name)
    );
    // const fieldValues = vmInstance.addEntityFormGroup.get("fields").value;
    const attributes = [{
        key: "template",
        value: vmInstance.template.name
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

function saveFields(vmInstance, assetId, formGroupName, fieldValues) {
    let fields = vmInstance[formGroupName];
    const attributes = [];
    for (const field of fields) {
        const key = field.name;
        if (
            key in fieldValues &&
            fieldValues[key] !== null &&
            fieldValues[key] !== undefined
        ) {
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

function removeHeadersAndReturnLines(fields, file) {
    const lines = file.split(/[\r\n]+/);
    const variables = lines[0].split("|");
    for (let variable of variables) {
        const names = fields.map(field => field.name);
        const labels = fields.map(field => field.label);
        if (names.includes(variable) || labels.includes(variable)) {
            lines.shift();
            break;
        }
    }
    const parsedLines = [];
    for (const line of lines) parsedLines.push(line.split("|"));
    while (
        parsedLines[parsedLines.length - 1].length === 1 &&
        parsedLines[parsedLines.length - 1][0] === ""
    ) {
        parsedLines.pop();
    }
    return parsedLines;
}

function checkVariableType(variable, field, mode) {
    let error;
    switch (field.type) {
        case "string":
            if (mode === "parse") return variable;
            break;
        case "integer":
            try {
                const parsed = parseInt(variable);
                if (isNaN(parsed) && field.required) throw new Error;
                if (isNaN(parsed) && mode === "parse") return null;
                if (mode === "parse") return parsed;
            } catch (err) {
                error = `${field.label} must be of type ${field.type}.`;
            }
            break;
        case "double":
            try {
                const parsed = parseFloat(variable);
                if (isNaN(parsed) && field.required) throw new Error;
                if (isNaN(parsed) && mode === "parse") return null;
                if (mode === "parse") return parsed;
            } catch (err) {
                error = `${field.label} must be of type ${field.type}.`;
            }
            break;
        case "boolean":
            const booleans = ["0", "1", "yes", "no", "true", "false"];
            if (!(booleans.includes(variable.toLowerCase()))) {
                error = `${field.label} must be one of ${booleans.join(",")}.`;
            } else if (mode === "parse") {
                if (["0", "no", "false"].includes(variable.toLowerCase())) return false;
                else return true;
            }
            break;
        case "enum":
            if (!(field.enumOptions.includes(variable.toLoweCase()))) error = `${field.label} must be one of ${field.enumOptions.join(",")}.`;
            break;
        case "json":
            try {
                const parsed = JSON.parse(variable);
                if (mode === "parse") return parsed;
            } catch (err) {
                error = `${field.label} must be of type ${field.type}.`;
            }
            break;
        default:
            error = `type ${field.type} not recognized...`;
    }
    return error;
}

function validateUploadedFile(vmInstance) {
    const file = vmInstance.bulkImportFormGroup.get("inputFile.file").value;
    // validate csv file and create table with assets to be created
    const fields = vmInstance.templateFields.concat(vmInstance.thresholdFields);
    const lines = removeHeadersAndReturnLines(fields, file);
    const results = [];
    const errors = [];
    // each row will start with a checkmark or an x 
    // each row will show all data for one of the assets to be created
    // rows that show x instead of checkmark will show reason for error
    // possible reasons:
    //  - entity name is not unique
    //  - required field is missing
    // ouput objects should look like: 
    /* {
        "result": {
            "line": integer,
            "displayName": string,
            "entityName": string , 
            "writtenAddres": string,
            "label": string,
            "latitude": double | undefined,
            "longitude": double | undefined
        },
        "error": {
            "line": integer,
            "value": error here....."
        }
    } */

    return rxjs.from(lines).pipe(
        rxjs.concatMap((line, row) => {
            const result = {
                line: row + 1
            };
            const error = {
                line: row + 1
            };
            let fieldIndex = 0;
            for (variable of line) {
                const field = fields[fieldIndex];
                // check if field is required
                if (field.required) {
                    if (variable == "") {
                        error.error = `${field.label} is required...`;
                        return rxjs.of(error);
                        /* throw new Error(
                            `${field.label} is required...`,
                            row
                        ); */
                        // error.error = `${field.label} is required...`;
                        // break;
                    }
                }
                // check variable type corresponds with field
                const typeError = checkVariableType(variable, field);
                if (typeError) {
                    error.error = typeError;
                    return rxjs.of(error);
                    // break;
                }
                result[field.name] = checkVariableType(variable, field, "parse");
                fieldIndex += 1;
            }
            // check uniqueness for asset name based on displayName
            if (result.displayName) {
                const assetName = buildAssetName(vmInstance, result.displayName);
                result.entityName = assetName;
                results.push(result);
                const pageLink = widgetContext.pageLink(
                    10,
                    0,
                    assetName
                );
                return assetService.getCustomerAssetInfos(
                    assetProfile,
                    vmInstance.customer.entityId.id,
                    pageLink
                ).pipe(
                    rxjs.map((assetsInfo) => {
                        const assetWithSameName = assetsInfo.data.find(
                            assetInfo => assetInfo.name === assetName
                        );
                        if (assetWithSameName) {
                            error.error = "An asset with the same unique identifier derived from display name already exists.";
                            return error;
                        }
                        return result;
                    })
                );
            } else {
                error.error = "no display name for asset in line " + row;
                return rxjs.of(error);
            }
        }),
        rxjs.catchError((error) => {
            console.log(">>> 📛 error:", error);
        })
    );
}

function checkAssetNameIsUnique(vmInstance, assetName) {
    let error;
    try {
        const pageLink = widgetContext.pageLink(
            10,
            0,
            assetName
        );
        assetService.getCustomerAssetInfos(
            assetProfile,
            vmInstance.customer.entityId.id,
            pageLink
        ).subscribe((response) => {
            debugger;
            const assetWithSameName = response.data.find(
                assetInfo => assetInfo.name === assetName
            );
            if (assetWithSameName) error = "An asset with the same unique identifier derived from display name already exists."
            return error;
        });
    } catch (err) {
        console.log(">>> 📛 error:", err);
        return err;
    }
}

function buildAssetName(vmInstance, displayName) {
    if (!vmInstance.customerCode) throw new Error("no customer code for curent customer 😐");
    let assetName = vmInstance.customerCode + "-" + vmInstance.template.templateName;
    assetName += "-" + humanToKebab(displayName);
    const uniqueHash = Math.floor(Math.random() * 0xffffff).toString(16).padEnd(8, "0");
    assetName = assetName.slice(0, 36); // so that names are the same length as tb ids.
    assetName += "-" + uniqueHash; // asset name length + 9 chars...
    return assetName;
}

function parseTemplateFields(attributes, vmInstance) {
    const fields = attributes.find((t) => t.key === "fields");
    if (!fields) throw new Error("this template has no fields attribute 😐");
    const fieldsObject = fields.value;
    fieldsObject.label = {
        type: "string",
        required: true,
        description: "for organizing purposes.",
        example: "asset-a01",
        bulk: true,
        order: 99
    };
    let templateFields = [];
    const requiredFields = [];
    const additionalFields = [];
    const mapFields = [];
    const imageFields = [];
    for (const fieldName in fieldsObject) {
        // ignore template
        const exclude = ["template"];
        if (exclude.includes(fieldName)) continue;
        const field = fieldsObject[fieldName];
        field.name = fieldName;
        if (!("label" in field)) field.label = camelToHuman(
            field.name
        );
        if ("specialType" in field) {
            if (field.specialType.startsWith("map")) {
                if (!field.bulk) continue;
                mapFields.push(field);
                continue;
            }
            if (field.specialType.startsWith("image")) {
                if (!field.bulk) continue;
                imageFields.push(field);
                continue;
            }
        }
        if (field.required) {
            if (!field.bulk) continue;
            requiredFields.push(field);
            continue;
        }
        if (!field.bulk) continue;
        additionalFields.push(field);
    }
    requiredFields.sort(sortByOrder);
    templateFields = requiredFields
        .concat(additionalFields)
        .concat(mapFields)
        .concat(imageFields);
    // in order to be used on create all assets
    vmInstance.requiredFields = requiredFields;
    vmInstance.additionalFields = additionalFields;
    vmInstance.mapFields = mapFields;
    return templateFields;
}

function sortByOrder(a, b) {
    let aOrder = a.order;
    let bOrder = b.order;
    if (aOrder == undefined || aOrder == null) aOrder = 99;
    if (bOrder == undefined || bOrder == null) bOrder = 99;
    return aOrder - bOrder;
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

function parseTemplateThresholds(attributes, vmInstance) {
    const fields = attributes.find((t) => t.key === "thresholds");
    if (!fields) return [];
    const fieldsObject = fields.value;
    const thresholdFields = [];
    for (const fieldName in fieldsObject) {
        const field = fieldsObject[fieldName];
        field.name = fieldName;
        if (!("label" in field)) field.label = camelToHuman(
            field.name
        );
        thresholdFields.push(field);
    }
    vmInstance.thresholdFields = thresholdFields;
    return thresholdFields;
}

function getEntityAttributes(id, keys) {
    return attributeService.getEntityAttributes(id, "SERVER_SCOPE", keys);
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
                var entityGroup = entityGroups.find(
                    (group) => group.name === assetProfile + "s"
                );
                if (entityGroup) {
                    return widgetContext.rxjs.of(entityGroup);
                } else {
                    entityGroup = {
                        type: "ASSET",
                        name: assetProfile + "s",
                        ownerId: customer.entityId,
                    };
                    return entityGroupService.saveEntityGroup(entityGroup);
                }
            })
        );
}

function fetchEntitiesFromGroup(groupId, entityType) {
    const pageLink = widgetContext.pageLink(100, 0);
    return entityGroupService.getEntityGroupEntities(
        groupId,
        pageLink,
        null,
        {},
        entityType
    );
}

function fetchGroupByName(groupName, entityType) {
    const pageLink = widgetContext.pageLink(10, 0, groupName);
    return entityGroupService.getEntityGroupsByPageLink(pageLink, entityType);
}

function openBulkImportDialog() {
    customDialog.customDialog(
        htmlTemplate,
        BulkImportAssetController
    ).subscribe();
}
