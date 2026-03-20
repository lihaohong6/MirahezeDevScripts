mw.hook('wikipage.content').add(function () {

    const DEBUG_MODE = ['localhost:', 'safemode=', 'action=submit']
        .some((str) => window.location.href.includes(str));

    const scriptUrl = 'https://cdn.jsdelivr.net/npm/datatables@1.10.18/media/js/jquery.dataTables.min.js';
    const filterWrappers = $('.filter-wrapper');
    if (!filterWrappers.length) {
        return;
    }

    /* Two search modes. Use enums in case we need to add more. */
    const StringMatchingMode = Object.freeze({
        CONTAINS: Symbol("contains"),
        EXACT: Symbol("exact")
    });

    class ColumnFilterManager {
        constructor(table) {
            this.table = table;
            // This is a mapping from column index to all the filter rows of that column.
            // The filters are themselves a Map from the row number to the filter object,
            // which tracks the filter mode (enum) and a Set of filter strings.
            // Roughly: Map<int, Map<int, {mode: StringMatchingMode, filters: Set<string>}>>
            this.columnFilters = new Map();
        }

        registerRow(colIndex, rowIndex, mode) {
            if (!this.columnFilters.has(colIndex)) {
                this.columnFilters.set(colIndex, new Map());
            }
            const columnMap = this.columnFilters.get(colIndex);
            columnMap.set(rowIndex, { mode, filters: new Set() });
        }

        toggleFilter(colIndex, rowIndex, query, isActive) {
            const rowData = this.columnFilters.get(colIndex).get(rowIndex);
            const { filters } = rowData;
            if (isActive) {
                filters.add(query);
            } else {
                filters.delete(query);
            }

            this.applyColumnFilter(colIndex);
        }

        clearRow(colIndex, rowIndex) {
            const rowData = this.columnFilters.get(colIndex).get(rowIndex);
            rowData.filters.clear();
            this.applyColumnFilter(colIndex);
        }

        rowHasFilters(colIndex, rowIndex) {
            const rowData = this.columnFilters.get(colIndex).get(rowIndex);
            return rowData.filters.size > 0;
        }

        applyColumnFilter(colIndex) {
            const columnMap = this.columnFilters.get(colIndex);
            if (!columnMap) {
                return;
            }

            const activeFilters = Array.from(columnMap.entries())
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .map(([_, rowData]) => rowData)
                .filter(rowData => rowData && rowData.filters && rowData.filters.size);

            if (activeFilters.length === 0) {
                this.table.column(colIndex).search('').draw();
                return;
            }

            if (activeFilters.length === 1) {
                const [{ mode, filters }] = activeFilters;
                const regex = Array.from(filters).join('|');
                const finalRegex = mode === StringMatchingMode.EXACT
                    ? '^(' + regex + ')$'
                    : regex;
                this.table.column(colIndex).search(finalRegex, true, false).draw();
                return;
            }

            const regexParts = activeFilters.map(({ mode, filters }) => {
                if (mode !== StringMatchingMode.CONTAINS) {
                    mw.notify(
                        `More than one filter row specifies the same column with exact matching mode. This should not happen.`,
                        { autoHide: false, type: 'error', title: 'FilterTable invalid matching mode.' }
                    );
                }
                const groupRegex = Array.from(filters).join('|');
                return `(?=.*(${groupRegex}))`;
            });

            const combinedRegex = regexParts.join('');
            this.table.column(colIndex).search(combinedRegex, true, false).draw();
        }
    }

    function preprocessTable($table) {
        // DataTable relies on the existence of a thead. It may exist due to sortable, but relying on
        // that creates a race condition, so we manually promote the first row.
        if ($table.find('thead').length === 0) {
            const $headerRow = $table.find('tr').first();
            const $thead = $('<thead></thead>').append($headerRow);
            $table.prepend($thead);
        }

        // Move inline styles out of the table to the <head>
        // so they aren't deleted when DataTables filters/removes rows.
        $table.find('style').each(function () {
            $(this).appendTo('head');
        });
    }

    function processRowCounter($wrapper, table) {
        // Counter for the current number of results
        const $counter = $wrapper.find('.filter-counter');
        const $counterTotal = $wrapper.find('.filter-counter-total');
        if ($counter.length) {
            table.on('draw', function () {
                const info = table.page.info();
                if (DEBUG_MODE) {
                    console.log(info);
                }
                $counter.text(info.recordsDisplay);
                $counterTotal.text(info.recordsTotal);
            });
        }
    }

    function processRow($row, table, filterManager, rowIndex) {
        const colIndex = parseInt($row.data('col')) - 1;
        if (isNaN(colIndex)) {
            return;
        }

        const modeString = $row.data('mode');
        let mode;
        if (modeString === "contains") {
            mode = StringMatchingMode.CONTAINS;
        } else {
            mode = StringMatchingMode.EXACT;
        }

        filterManager.registerRow(colIndex, rowIndex, mode);

        const $allBtn = $row.find('.filter-button.is-all');
        const $optionButtons = $row.find('.filter-button').not('.is-all');

        $allBtn.on('click', function () {
            $row.find('.filter-button').removeClass('button-selected');
            $(this).addClass('button-selected');
            filterManager.clearRow(colIndex, rowIndex);
        });

        $optionButtons.on('click', function () {
            const $this = $(this);
            const rawQuery = $this.attr('data-query') || $this.text().trim();

            const query = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const isActive = $this.hasClass('button-selected');
            filterManager.toggleFilter(colIndex, rowIndex, query, !isActive);
            $this.toggleClass('button-selected');

            const hasActiveFilters = filterManager.rowHasFilters(colIndex, rowIndex);
            $allBtn.toggleClass('button-selected', !hasActiveFilters);
        });

        $allBtn.trigger('click');
    }

    function processSearchFields($wrapper, table) {
        const searchFields = [];
        $wrapper.find('.filter-search').each(function () {
            const $container = $(this);
            const $searchField = $('<input type="text" placeholder="Type to search..." />');

            $searchField.on('keyup input', function () {
                table.search(this.value).draw();
            });

            $container.append($searchField);
            searchFields.push($searchField);
        });
        return searchFields;
    }

    function processResetAllButton($wrapper, searchFields) {
        // Button to reset everything
        $wrapper.find('.filter-reset').on('click', function () {
            searchFields.forEach(function ($searchField) {
                $searchField.val('').trigger('input');
            });

            // For rows with a "select all" button
            $wrapper.find('.filter-row').each(function () {
                const $selectAllButton = $(this).find('.is-all');
                if ($selectAllButton.length) {
                    $selectAllButton.trigger('click');
                } else {
                    $(this).find('.filter-button.button-selected').trigger('click');
                }
            });
        });
    }

    $.getScript(scriptUrl, function () {
        $('.filter-wrapper').each((_, element) => {
            const $wrapper = $(element);
            // Don't use jQuery's # to query since data-table-id can contain an arbitrary string
            const tableId = $wrapper.data('table-id');
            const $table = $(document.getElementById(tableId));

            if (!$table.length) {
                return;
            }

            preprocessTable($table);

            let table;
            try {
                table = $table.DataTable({
                    paging: false,
                    info: false,
                    searching: true,
                    dom: 't',
                    autoWidth: false,
                    responsive: false,
                    order: [] // disable initial order
                });
            } catch (e) {
                mw.notify(`Error initializing DataTable on table with id ${tableId}.\nMessage: ${e.message}`,
                    { autoHide: false, type: 'error', title: 'FilterTable initialization failed.' } )
                return;
            }

            const filterManager = new ColumnFilterManager(table);

            // Double wrapper on Citizen causes issues. Remove the DataTables wrapper.
            if (mw.config.get("skin") === "citizen") {
                $table.unwrap(".dataTables_wrapper");
            }

            processRowCounter($wrapper, table);

            const searchFields = processSearchFields($wrapper, table);

            // Process each row of filter buttons
            $wrapper.find('.filter-row').each(function (index) {
                processRow($(this), table, filterManager, index);
            });

            processResetAllButton($wrapper, searchFields);

        });
    });
});