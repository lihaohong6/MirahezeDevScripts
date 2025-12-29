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

    function processRow($row, table) {
        // 1-based indexing for columns
        const colIndex = parseInt($row.data('col')) - 1;
        // Column must be defined
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

        let activeFilters = [];

        const $allBtn = $row.find('.filter-button.is-all');
        const $optionButtons = $row.find('.filter-button').not('.is-all');

        $allBtn.on('click', function () {
            activeFilters = [];
            $row.find('.filter-button').removeClass('button-selected');
            $(this).addClass('button-selected');
            table.column(colIndex).search('').draw();
        });

        $optionButtons.on('click', function () {
            const $this = $(this);
            const rawQuery = $this.attr('data-query') || $this.text().trim();

            // Escape regex special characters to prevent errors with names like "A-Team (Beta)"
            const query = rawQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const index = activeFilters.indexOf(query);

            if (index > -1) {
                // Toggle off
                activeFilters.splice(index, 1);
                $this.removeClass('button-selected');
            } else {
                // Toggle on
                activeFilters.push(query);
                $this.addClass('button-selected');
            }

            // Filters are updated. Now apply them.
            if (activeFilters.length === 0) {
                $allBtn.addClass('button-selected');
                table.column(colIndex).search('').draw();
            } else {
                $allBtn.removeClass('button-selected');
                let regex = activeFilters.join('|');
                if (mode === StringMatchingMode.EXACT) {
                    // Use regex ^(Option1|Option2)$ for exact matches
                    regex = '^(' + regex + ')$';
                }
                table.column(colIndex).search(regex, true, false).draw();
            }
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
                });
            } catch (e) {
                mw.notify(`Error initializing DataTable on table with id ${tableId}.\nMessage: ${e.message}`,
                    { autoHide: false, type: 'error', title: 'FilterTable initialization failed.' } )
                return;
            }

            // Double wrapper on Citizen causes issues. Remove the DataTables wrapper.
            if (mw.config.get("skin") === "citizen") {
                $table.unwrap(".dataTables_wrapper");
            }

            processRowCounter($wrapper, table);

            const searchFields = processSearchFields($wrapper, table);

            // Process each row of filter buttons
            $wrapper.find('.filter-row').each(function () {
                processRow($(this), table);
            });

            processResetAllButton($wrapper, searchFields);

        });
    });
});