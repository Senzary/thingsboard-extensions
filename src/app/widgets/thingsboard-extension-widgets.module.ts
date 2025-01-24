///
/// Copyright © 2023 ThingsBoard, Inc.
///

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import addCustomWidgetLocale from './locale/custom-widget-locale.constant';
import { ExampleModule } from './components/example/example.module';

import { HierarchyTreeModule } from './components/hierarchy-tree/hierarchyTree.module';
import { SharedModule } from '@shared/public-api';
import { HomeComponentsModule } from '@home/components/public-api';
import { ExampleMapComponent } from './components/map/example-map.component';
import { CustomAlarmsTableWidgetComponent } from './components/alarm/custom-alarms-table-widget.component';
import { HierarchyTreeComponent } from './components/hierarchy-tree/hierarchyTree.component';

@NgModule({
  declarations: [
    ExampleMapComponent,
    CustomAlarmsTableWidgetComponent
  ],
  imports: [
    CommonModule,
    HomeComponentsModule,
    SharedModule
  ],
  exports: [
    HierarchyTreeModule,
    ExampleMapComponent,
    ExampleModule,
    CustomAlarmsTableWidgetComponent
  ]
})
export class ThingsboardExtensionWidgetsModule {

  constructor(translate: TranslateService) {
    addCustomWidgetLocale(translate);
  }

}
