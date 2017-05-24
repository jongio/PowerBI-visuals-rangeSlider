/// <amd-dependency path='noUiSlider'>

module powerbi.extensibility.visual {

    export class Visual implements IVisual {
        private selectionManager: ISelectionManager;
        private target: HTMLElement;
        private slider: any;
        private host: IVisualHost;
        private container: HTMLElement;
        private selectionIds: any = {};
        private settings: any;
        private clearFilterNumber: number = -12000; // Hard coded number that tells the visual to clear filter.
        private currentValue;
        private isApplySelectionFilterUpdate = false; // This is here to prevent an endless loop of updates, from the slider set to the update method.

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.target = options.element;
            this.selectionManager = options.host.createSelectionManager();
        }

        public update(options: VisualUpdateOptions) {

            //debugger;

            this.getSettings(options);

            if (options.type & powerbi.VisualUpdateType.Data && !this.isApplySelectionFilterUpdate) {
                this.init(options);
            }
        }

        public init(options: VisualUpdateOptions) {
            var data = this.getData(options);
            if (data) {
                this.initSlider(data);
            }
        }

        public getData(options: VisualUpdateOptions): any {

            // Make sure we have category data
            if (!options ||
                !options.dataViews ||
                !options.dataViews[0] ||
                !options.dataViews[0].categorical ||
                !options.dataViews[0].categorical.categories ||
                !options.dataViews[0].categorical.categories[0]) {
                return null;
            }

            //debugger;

            let dataView = options.dataViews[0];
            let categorical = dataView.categorical;
            let category = categorical.categories[0];

            // asc sort and remove empty values
            let values = category.values.sort((n1: number, n2: number) => n1 - n2).filter(Boolean);

            // build selection ids to be used by filtering capabilities later
            values.forEach((item: number, index: number) => {
                this.selectionIds[item] = this.host.createSelectionIdBuilder()
                    .withCategory(category, index)
                    .createSelectionId()
            });

            // Add the magic clear filter number to the zero index
            values.unshift(this.clearFilterNumber);

            // Build up the range so we have a step for each value in the dataset.
            let step: number = 0;
            let range: any = {};
            range.min = range['0%'] = values[0]; // The left most item is always clear.
            range.max = range['100%'] = values[values.length - 1]; // The right most item is always the last value

            if (values.length > 1) {
                range['1%'] = values[1]; // The value just to the right of the clear is always the first value.

                // Add the rest of the values.
                for (var i = 2; i <= values.length - 2; i++) {
                    step = (100 / (values.length - 2)) + step;
                    range[step + '%'] = values[i];
                }
            }

            return {
                range: range
            }
        }

        public initSlider(data: any) {
            let that = this; // This is needed for the slider event handlers

            // remove any children from previous slider renders
            while (this.target.firstChild) {
                this.target.removeChild(this.target.firstChild);
            }

            // Put slider in a container so we can style it independent of the host container.
            this.container = document.createElement('div');
            this.container.className = 'container';
            this.target.appendChild(this.container);

            this.slider = noUiSlider.create(this.container, {
                start: this.currentValue || this.settings.defaultSelectedValue || data.range.min,
                connect: true,
                step: 1,
                range: data.range,
                snap: true,
                tooltips: true,
                format: {
                    from: function (value) {
                        if (value === that.clearFilterNumber) {
                            return '-';
                        }
                        return parseFloat(value);
                    },
                    to: function (value) {
                        if (value === that.clearFilterNumber) {
                            return '-';
                        }
                        return parseFloat(value);
                    }
                }
            });
            this.filter(this.slider.get());
            this.slider.on('set', this.filter.bind(this));
        }

        private filter(values) {
            //debugger;
            //console.log('filterReport');
            this.isApplySelectionFilterUpdate = true;

            let value = values[0] || values;

            value = !value || value === '-' ? this.clearFilterNumber : +value;

            this.currentValue = value;

            if (value === this.clearFilterNumber) {
                this.selectionManager.clear();
            } else {
                this.selectionManager.select(this.selectionIds[value]).then((ids: ISelectionId[]) => {
                    //ids.forEach(function (id) {
                    //    console.log(id);
                    //});
                });
            }

            this.selectionManager.applySelectionFilter();
        }

        private getSettings(options: VisualUpdateOptions): boolean {
            let changed = false;
            let dataView = options.dataViews[0];

            if (dataView) {
                let objects = dataView.metadata.objects;

                this.settings = {
                    defaultSelectedValue: getValue<number>(objects, 'data', 'defaultSelectedValue', null)
                };
            }
            return changed;
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {

            /*            if (!this.settings) {
                            return;
                        }
            */
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];

            switch (objectName) {
                case 'data':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: {
                            defaultSelectedValue: this.settings.defaultSelectedValue
                        },
                        selector: null
                    });

                    break;
            };

            return objectEnumeration;
        }
    }
}