///
/// Copyright © 2023 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import addCustomWidgetLocale from './locale/custom-widget-locale.constant';
import { CommonModule } from '@angular/common';
import { ExamplesModule } from './components/examples/examples.module';
import { addLibraryStyles } from './scss/lib-styles';
import { HierarchyTreeModule } from './components/hierarchy-tree/hierarchyTree.module';
import { BreadcrumbsModule, CustomersAndGroupsModule, SZFormFieldsetModule, SZNavbarModule, UserManagerModule } from './public-api';


@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ],
  exports: [
    SZNavbarModule,
    HierarchyTreeModule,
    ExamplesModule,
    BreadcrumbsModule,
    CustomersAndGroupsModule,
    SZFormFieldsetModule,
    UserManagerModule
  ]
})
export class ThingsboardExtensionWidgetsModule {

  constructor(translate: TranslateService) {
    addCustomWidgetLocale(translate);
    addLibraryStyles('tb-extension-css');
  }

}
