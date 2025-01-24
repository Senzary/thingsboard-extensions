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

function openBulkImportDialog() {
    customDialog.customDialog(
        htmlTemplate,
        BulkImportDeviceController
    ).subscribe();
}

function parseRequiredFieldsExamples(fields, customDictionary = {}) {
    const examplesDictionary = {
        "manufacturer": "Dragino",
        "model": "LHT65N",
        "devEUI": "A40500F2006C2DF1",
        "template": "air-conditions-template",
        "appEui": "A840410000000100",
        "appKey": "729D870A92DE0F08702F9380624BF52C",
        "ismBand": "us915",
        "lnsActivation": "CREATE_OTAA",
        "lnsConnections": "Connection One, CONN-TWO",
        "lnsDomains": "domainGroup:domainName, domainGroup:otherName",
        "lnsTags": "cust:aesglobal-aesargentina, model:lht65-n, manufacturer:Dragino",
        "lnsModelId": "DRAG/LHT65A.1.0.3a_FCC",

    };
    const examples = [];
    for (const field of fields) {
        if (field.name.toString() in customDictionary) {
            examples.push(customDictionary[field.name]);
            continue;
        }
        examples.push(examplesDictionary[field.name]);
    }
    return examples;
}

openBulkImportDialog();

function BulkImportDeviceController(instance) {
    const params = stateController.getStateParams();
    const vm = instance;
    // customer and location
    vm.currentCustomer = params.currentCustomer;
    vm.currentLocation = params.currentLocation;
    vm.lnsInstances = [];
    // populate lns instances 
    const credentialAssetsObservable = getCredentialAssetsObservable()
        .pipe(
            rxjs.switchMap((lnsInstances) => {
                console.log(">>> 💚", lnsInstances);
                vm.lnsInstances = lnsInstances;
                return rxjs.of(lnsInstances);
            })
        );
    const deviceTemplatesObservable = getDeviceTemplatesObservable()
        .pipe(
            rxjs.switchMap((templates) => {
                vm.templates = templates;
                const requiredFieldsObject = templates[0].fields;
                console.log(">>> 💛 requiredFieldsObject", requiredFieldsObject);
                const fields = [];
                for (const key in requiredFieldsObject) {
                    const field = requiredFieldsObject[key];
                    field.name = key;
                    if (!("label" in field)) field.label = camelToHuman(
                        field.name
                    );
                    if (field.name === "template") field.order = 99;
                    fields.push(field);
                }
                fields.sort(sortByOrder);
                vm.csvRequiredFields = fields.filter(
                    (field) => field.required
                );
                vm.csvFieldsList = vm.csvRequiredFields.map(
                    (field) => field.label
                );
                vm.csvExamplesList = parseRequiredFieldsExamples(vm.csvRequiredFields);
                return rxjs.of(templates);
            })
        );
    const setUpObservable = rxjs.forkJoin([
        credentialAssetsObservable,
        deviceTemplatesObservable
    ]);
    setUpObservable.subscribe((responses) => {
    });
    vm.bulkImportFormGroup = vm.fb.group({
        inputFile: vm.fb.group({
            lnsInstance: [null, [vm.validators.required]],
            file: [null, [vm.validators.required]]
        }),
        validation: vm.fb.group({}),
        results: vm.fb.group({})
    });
    vm.onLNSInstanceChange = function (event) {
        const chosenLNS = event.value;
        const provisioningFieldsObject = chosenLNS.provisioning;
        const fields = [];
        for (const key in provisioningFieldsObject) {
            const field = provisioningFieldsObject[key];
            if (field.hide && key !== "lnsModelId") continue;
            field.name = key;
            if (!("label" in field)) field.label = camelToHuman(
                field.name
            );
            fields.push(field);
        }
        fields.unshift({
            name: "lns",
            label: "LNS instance"
        });
        vm.csvProvisioningFields = fields;
        vm.csvLNSFieldsList = vm.csvProvisioningFields.map(
            (field) => field.label
        );
        vm.csvLNSExamplesList = parseRequiredFieldsExamples(
            vm.csvProvisioningFields, { lns: chosenLNS.name }
        );
    }
    vm.cancel = function () {
        vm.entity = null;
        vm.entityId = null;
        vm.entityName = null;
        vm.dialogRef.close(null);
    };
    vm.save = function () { };
    vm.validateIncomingFile = function () {
        const inputFileValues = bulkImportFormGroup.get("inputFile");
        // check template and validate/parse required fields
        // check device name is unique
        // check if lns and validate/parse provisioning fields
        // save to vm both valid results and errors
    };
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

function kebabToHuman(kebabStr) {
    return kebabStr.trim().split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
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

function camelToHuman(camelStr) {
    const words = camelStr.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
    let humanStr = words.shift().toLowerCase();
    humanStr = humanStr.charAt(0).toUpperCase() + humanStr.slice(1);
    for (const word of words) {
        humanStr += ` ${word.toLowerCase()}`;
    }
    return humanStr;
}

function sortByOrder(a, b) {
    let aOrder = a.order;
    let bOrder = b.order;
    if (!aOrder) aOrder = 99;
    if (!bOrder) bOrder = 99;
    return aOrder - bOrder;
}


