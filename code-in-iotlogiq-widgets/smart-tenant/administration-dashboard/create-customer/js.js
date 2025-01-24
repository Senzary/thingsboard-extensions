let baseURL = window.location.origin
/**************************************/
/*CHANGE DASHBOARD GROUP NAME IN CASE NAME OF THIS GROUP CHANGES*/
const groupDashboardName = "Smart Industry Dashboards";
/**************************************/
//const DISTRIBUTOR_DASHBOARD_GROUP_ID = "908299d0-4021-11ed-949c-f5ac7e9f0044";
const CUSTOMER_DASHBOARD_GROUP_ID = "fa573450-90db-11ed-b568-2d0d9e2d0e02";
const PROCESS_CODES_GROUP_ID = "3062ef80-b9db-11ed-b366-d93095c2dda7";
// @ernestomedinam this was not in use... 20240912

let $injector = widgetContext.$scope.$injector;
const stateController = widgetContext.stateController;
const rxjs = widgetContext.rxjs;
const entityRelationService = $injector.get(widgetContext.servicesMap.get("entityRelationService"));
let customDialog = $injector.get(widgetContext.servicesMap.get("customDialog"));
let customerService = $injector.get(
    widgetContext.servicesMap.get("customerService")
);
let entityGroupService = $injector.get(
    widgetContext.servicesMap.get("entityGroupService")
);
let roleService = $injector.get(widgetContext.servicesMap.get("roleService"));
let attributeService = $injector.get(
    widgetContext.servicesMap.get("attributeService")
);
let dashboardService = $injector.get(
    widgetContext.servicesMap.get("dashboardService")
);

openAddCompanyDialog();

const companyNatures = [
    { label: "Client", value: "Clients" },
    { label: "Partner", value: "Partners" },
    { label: "Integrator", value: "Integrators" },
    { label: "Other", value: "Others" }
];
const orphanCompanyNatures = [
    { label: "Client", value: "Clients" },
    { label: "IoT Commercial", value: "IoT-Commercial" },
    { label: "NanoTrac", value: "NanoTrac" }
];

var params = widgetContext.stateController.getStateParams();
var selectedClient = params.selectedClient;

function openAddCompanyDialog() {
    customDialog
        .customDialog(htmlTemplate, AddCompanyDialogController)
        .subscribe();
}

function getCustomersObservable() {
    const pageLink = widgetContext.pageLink(1000, 0);
    return customerService.getCustomers(pageLink).pipe(
        rxjs.map((response) => response.data)
    );
}

function AddCompanyDialogController(instance) {
    let vm = instance;
    const params = stateController.getStateParams();
    vm.currentUser = widgetContext.currentUser;
    vm.customers = [];
    vm.companyNatures = orphanCompanyNatures;
    const customerObservable = getCustomersObservable();
    customerObservable.subscribe((customers) => vm.customers = customers);
    vm.addCustomerFormGroup = vm.fb.group({
        parentCustomer: [null, []],
        title: ["", [vm.validators.required, vm.validators.maxLength(255)]],
        companyNature: [companyNatures[0], [vm.validators.required]]
    });
    vm.addCustomerFormGroup.addControl("country", vm.fb.control("", []));
    vm.addCustomerFormGroup.addControl("city", vm.fb.control("", []));
    vm.addCustomerFormGroup.addControl("state", vm.fb.control("", []));
    vm.addCustomerFormGroup.addControl(
        "zip",
        vm.fb.control("", zipValidators(""))
    );
    vm.addCustomerFormGroup.addControl("address", vm.fb.control("", []));
    vm.addCustomerFormGroup.addControl("address2", vm.fb.control("", []));
    vm.addCustomerFormGroup.addControl("phone", vm.fb.control("", []));
    vm.addCustomerFormGroup.addControl(
        "email",
        vm.fb.control("", [vm.validators.email])
    );
    vm.addCustomerFormGroup.get("country").valueChanges.subscribe((country) => {
        vm.addCustomerFormGroup.get("zip").setValidators(zipValidators(country));
        vm.addCustomerFormGroup.get("zip").updateValueAndValidity({
            onlySelf: true,
        });
        vm.addCustomerFormGroup.get("zip").markAsTouched({
            onlySelf: true,
        });
    });
    vm.cancel = function () {
        vm.dialogRef.close(null);
    };
    vm.save = function () {
        vm.addCustomerFormGroup.markAsPristine();
        const formValues = vm.addCustomerFormGroup.value;
        const createCompanyObservable = getCreateCompanyObservable().pipe(
            rxjs.switchMap(function (newCustomer) {
                return rxjs.forkJoin([
                    saveAttributes(newCustomer),
                    saveUserGroups(newCustomer.id)
                ]);
            })
        ).subscribe(function () {
            widgetContext.updateAliases();
            vm.cancel();
        });
    };

    vm.updateCompanyNatures = function (event) {
        if (event.value) {
            vm.companyNatures = companyNatures;
            return;
        }
        vm.companyNatures = orphanCompanyNatures;
    };

    function zipValidators(country) {
        const POSTAL_CODE_PATTERNS = {
            "United States": "(\\d{5}([\\-]\\d{4})?)",
            Australia: "[0-9]{4}",
            Austria: "[0-9]{4}",
            Belgium: "[0-9]{4}",
            Brazil: "[0-9]{5}[\\-]?[0-9]{3}",
            Canada: "^(?!.*[DFIOQU])[A-VXY][0-9][A-Z][ -]?[0-9][A-Z][0-9]$",
            Denmark: "[0-9]{3,4}",
            "Faroe Islands": "[0-9]{3,4}",
            Netherlands: "[1-9][0-9]{3}\\s?[a-zA-Z]{2}",
            Germany: "[0-9]{5}",
            Hungary: "[0-9]{4}",
            Italy: "[0-9]{5}",
            Japan: "\\d{3}-\\d{4}",
            Luxembourg: "(L\\s*(-|—|–))\\s*?[\\d]{4}",
            Poland: "[0-9]{2}\\-[0-9]{3}",
            Spain: "((0[1-9]|5[0-2])|[1-4][0-9])[0-9]{3}",
            Sweden: "\\d{3}\\s?\\d{2}",
            "United Kingdom":
                "[A-Za-z]{1,2}[0-9Rr][0-9A-Za-z]? [0-9][ABD-HJLNP-UW-Zabd-hjlnp-uw-z]{2}",
        };
        const zipValidators = [];
        if (country && POSTAL_CODE_PATTERNS[country]) {
            const postalCodePattern = POSTAL_CODE_PATTERNS[country];
            zipValidators.push(vm.validators.pattern(postalCodePattern));
        }
        return zipValidators;
    }

    function getCreateCompanyObservable() {
        const formValues = vm.addCustomerFormGroup.value;
        let parent = formValues.parentCustomer;
        // resolve parent customer
        if (!parent && vm.currentUser.authority === "TENANT_ADMIN") parent = {
            id: {
                id: vm.currentUser.tenantId,
                entityType: "TENANT"
            }
        }
        if (!parent) parent = {
            id: {
                id: vm.currentUser.customerId,
                entityType: "CUSTOMER"
            }
        };
        // get customer group ID for formValues.companyNature
        const groupName = formValues.companyNature.value;
        const customerGroupObservable = getCustomerGroupFor(
            parent.id,
            groupName
        ).pipe(
            rxjs.switchMap(function (group) {
                let resultObservable = rxjs.of(group);
                if (!group) {
                    // create group
                    resultObservable = entityGroupService.saveEntityGroup({
                        type: "CUSTOMER",
                        name: groupName,
                        ownerId: parent.id
                    });
                }
                return resultObservable;
            })
        );
        // create new customer payload
        const newCustomer = {
            title: new Date().getTime() + " " + formValues.title,
            country: formValues.country,
            city: formValues.city,
            state: formValues.state,
            zip: formValues.zip,
            address: formValues.address,
            address2: formValues.address2,
            phone: formValues.phone,
            email: formValues.email,
            ownerId: parent.id,
            additionalInfo: {
                origin: `administration dashboard, by ${vm.currentUser.firstName} ${vm.currentUser.lastName} on ${new Date().toISOString()}.`
            }
        };
        if (parent.entityType === "CUSTOMER") newCustomer
            .parentCustomerId = parent.id;
        // now we have id for customer group of parent customer
        const createdCustomerObservable = customerGroupObservable.pipe(
            rxjs.switchMap(function (group) {
                return customerService.saveCustomer(
                    newCustomer,
                    group.id.id
                );
            }),
            rxjs.switchMap(function (customer) {
                return entityRelationService.saveRelation({
                    from: customer.parentCustomerId,
                    type: "Contains",
                    to: customer.id
                }).pipe(
                    rxjs.map(() => customer)
                );
            })
        );
        // if there is a parent customer, create contains relation
        // if (parent.entityType === "CUSTOMER") createdCustomerObservable
        //     .pipe(
        //         rxjs.switchMap(function(customer) {
        //             return entityRelationService.saveRelation({
        //                 from: parent,
        //                 type: "Contains",
        //                 to: customer.id
        //             });
        //         })    
        //     );
        // return saveCustomer attached to customer group.
        return createdCustomerObservable;
    }

    function getCustomerGroupFor(groupOwnerId, groupName) {
        const pageLink = widgetContext.pageLink(
            100,
            0,
            groupName
        );
        return entityGroupService.getEntityGroupsByOwnerIdAndPageLink(
            groupOwnerId.entityType,
            groupOwnerId.id,
            "CUSTOMER",
            pageLink,
            { ignoreLoading: true }
        ).pipe(
            rxjs.map(function (data) {
                const groups = data.data;
                return groups.find(group => group.name === groupName);
            })
        );
    }

    function saveUserGroups(customerId) {
        return widgetContext.rxjs
            .forkJoin([
                //adding roles permissions
                getRoleByName("AES Admins", "GENERIC"),
                getRoleByName("AES Supervisors", "GENERIC"),
                getRoleByName("AES Viewers", "GENERIC"),

                //adding group permissions
                getRoleByName("AES Group Permission for Admins", "GROUP"),
                getRoleByName("AES Group Permissions for Viewers", "GROUP"),
                getRoleByName("AES Group Permissions for Supervisors", "GROUP"),
                getEntityGroupByName(groupDashboardName, "DASHBOARD"),
                getRoleByName("Customer Administrator", "GENERIC")

            ])
            .pipe(
                widgetContext.rxjs.switchMap((data) => {
                    //roles permissions
                    var adminGenericRole = data[0]; //data = forkJoin array data
                    var supervisorGenericRole = data[1];
                    var viewerGenericRole = data[2];
                    var customerAdminGenericRole = data[7]; /*****/

                    //group permissions
                    var adminGroupRole = data[3];
                    var supervisorGroupRole = data[4];
                    var viewerGroupRole = data[5];

                    //dashboard default
                    var customerDasboardGroup = data[6];

                    // User Groups
                    var admins = { type: "USER", name: "Admins", ownerId: customerId };
                    var supervisors = {
                        type: "USER",
                        name: "Supervisors",
                        ownerId: customerId,
                    };
                    var viewers = { type: "USER", name: "Viewers", ownerId: customerId };
                    var superAdmins = { type: "USER", name: "Customer Administrators 2", ownerId: customerId };

                    // Asset Groups
                    var locations = { type: "ASSET", name: "Locations", ownerId: customerId };
                    var areas = { type: "ASSET", name: "Areas", ownerId: customerId };
                    var machines = { type: "ASSET", name: "Machines", ownerId: customerId };

                    // Device Groups
                    var assignedDevices = {
                        type: "DEVICE",
                        name: "Assigned Devices",
                        ownerId: customerId,
                    };
                    var unassignedDevices = {
                        type: "DEVICE",
                        name: "Unassigned Devices",
                        ownerId: customerId,
                    };

                    var clientsCustomers = {
                        type: "CUSTOMER",
                        name: "Clients",
                        ownerId: customerId,
                    };

                    return widgetContext.rxjs
                        .forkJoin([
                            entityGroupService.saveEntityGroup(admins),
                            entityGroupService.saveEntityGroup(supervisors),
                            entityGroupService.saveEntityGroup(viewers),

                            entityGroupService.saveEntityGroup(locations),
                            entityGroupService.saveEntityGroup(areas),
                            entityGroupService.saveEntityGroup(machines),

                            entityGroupService.saveEntityGroup(assignedDevices),
                            entityGroupService.saveEntityGroup(unassignedDevices),
                            entityGroupService.saveEntityGroup(superAdmins)
                        ])
                        .pipe(
                            widgetContext.rxjs.switchMap((data) => {
                                //data = forkJoin array data
                                var adminsUsersGroup = data[0]; //user groups for getting id
                                var supervisorUsersGroup = data[1];
                                var viewerUsersGroup = data[2];

                                var superAdminsUsersGroup = data[8];
                                //var clientsUsersGroup = data[8];

                                const tasks = [];

                                //adding generic roles to user
                                //ADMIN
                                if (adminGenericRole) {
                                    let adminUserGenericPermission = {
                                        userGroupId: adminsUsersGroup.id,
                                        roleId: adminGenericRole.id,
                                    };
                                    let superAdminUserGenericPermission = {
                                        userGroupId: superAdminsUsersGroup.id,
                                        roleId: customerAdminGenericRole.id,
                                    };
                                    let adminSuperAdminGenericPermission = {
                                        userGroupId: superAdminsUsersGroup.id,
                                        roleId: adminGenericRole.id,
                                    };
                                    tasks.push(
                                        roleService.saveGroupPermission(adminUserGenericPermission),
                                        roleService.saveGroupPermission(superAdminUserGenericPermission),
                                        roleService.saveGroupPermission(adminSuperAdminGenericPermission)
                                    );
                                }

                                //SUPERVISOR
                                if (supervisorGenericRole) {
                                    let supervisorUserGenericPermission = {
                                        userGroupId: supervisorUsersGroup.id,
                                        roleId: supervisorGenericRole.id,
                                    };
                                    tasks.push(
                                        roleService.saveGroupPermission(supervisorUserGenericPermission)
                                    );
                                }

                                //VIEWER
                                if (viewerGenericRole) {
                                    let viewerUserGenericPermission = {
                                        userGroupId: viewerUsersGroup.id,
                                        roleId: viewerGenericRole.id,
                                    };
                                    tasks.push(
                                        roleService.saveGroupPermission(viewerUserGenericPermission)
                                    );
                                }

                                // adding permission for user groups to access customer dashboard group
                                if (customerDasboardGroup) {
                                    // ADMINS
                                    if (adminGroupRole) {
                                        let adminsUsersToDashboard = {
                                            userGroupId: adminsUsersGroup.id,
                                            roleId: adminGroupRole.id,
                                            entityGroupId: customerDasboardGroup.id,
                                            entityGroupType: customerDasboardGroup.type,
                                        };
                                        let superAdminUserGenericPermission = {
                                            userGroupId: superAdminsUsersGroup.id,
                                            roleId: adminGroupRole.id,
                                            entityGroupId: customerDasboardGroup.id,
                                            entityGroupType: customerDasboardGroup.type,
                                        };
                                        tasks.push(
                                            roleService.saveGroupPermission(adminsUsersToDashboard),
                                            roleService.saveGroupPermission(superAdminUserGenericPermission)
                                        );
                                    }
                                    // Supervisors
                                    if (supervisorGroupRole) {
                                        let supervisorsUsersToDashboard = {
                                            userGroupId: supervisorUsersGroup.id,
                                            roleId: supervisorGroupRole.id,
                                            entityGroupId: customerDasboardGroup.id,
                                            entityGroupType: customerDasboardGroup.type,
                                        };
                                        tasks.push(
                                            roleService.saveGroupPermission(supervisorsUsersToDashboard)
                                        );
                                    }
                                    // Viewers
                                    if (viewerGroupRole) {
                                        let viewersUsersToDashboard = {
                                            userGroupId: viewerUsersGroup.id,
                                            roleId: viewerGroupRole.id,
                                            entityGroupId: customerDasboardGroup.id,
                                            entityGroupType: customerDasboardGroup.type,
                                        };
                                        tasks.push(roleService.saveGroupPermission(viewersUsersToDashboard));
                                    }
                                }

                                if (tasks.length) {
                                    return widgetContext.rxjs.forkJoin(tasks);
                                } else {
                                    return widgetContext.rxjs.of(null);
                                }
                            })
                        );
                })
            );
    }

    //get role data (name and id)
    function getRoleByName(roleName, type) {
        var rolesPageLink = widgetContext.pageLink(10, 0, roleName);
        return roleService
            .getRoles(rolesPageLink, type, {
                ignoreLoading: true,
            })
            .pipe(
                widgetContext.rxjs.map((data) => {
                    if (data.data.length) {
                        return data.data.find((role) => role.name === roleName);
                    } else {
                        return null;
                    }
                })
            );
    }

    //function to get entity group data
    function getEntityGroupByName(groupName, groupType) {
        var entityGroupsPageLink = widgetContext.pageLink(10, 0, groupName);
        return entityGroupService
            .getEntityGroupsByPageLink(entityGroupsPageLink, groupType, {
                ignoreLoading: true,
            })
            .pipe(
                widgetContext.rxjs.map((data) => {
                    if (data.data.length) {
                        return data.data.find((group) => group.name === groupName);
                    } else {
                        return null;
                    }
                })
            );
    }

    function getUserDashboards(dashboardGroupId) {
        var dashboardsPageLink = widgetContext.pageLink(100, 0);
        return entityGroupService
            .getEntityGroupEntities(dashboardGroupId, dashboardsPageLink, {
                ignoreLoading: true,
            })
            .pipe(
                widgetContext.rxjs.map((data) => {
                    if (data.data.length) {
                        return data.data;
                    } else {
                        return null;
                    }
                })
            );
    }

    function saveAttributes(customer) {
        // let attributes = vm.addCustomerFormGroup.get('attributes').value;
        const formValues = vm.addCustomerFormGroup.value;
        let attributesArray = [{
            key: "writtenAddress",
            value: getAddressValue(customer)
        }, {
            key: "address",
            value: getAddressValue(customer)
        }];
        return attributeService.saveEntityAttributes(
            customer.id,
            "SERVER_SCOPE",
            attributesArray
        );
    }

    function getAddressValue(customer) {
        var address = "";
        if (customer.address) address += customer.address;
        if (customer.address2) address += (address ? ", " : "") + customer.address2;
        if (customer.city) address += (address ? ", " : "") + customer.city;
        if (customer.state) address += (address ? ", " : "") + customer.state;
        if (customer.zip) address += (customer.state ? " " : address ? ", " : "") + customer.zip;
        if (customer.country) address += (address ? ", " : "") + customer.country;
        return address;
    }
}
