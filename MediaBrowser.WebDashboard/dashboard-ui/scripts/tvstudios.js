﻿(function ($, document) {

    // The base query options
    var data = {};

    function getQuery() {

        var key = getSavedQueryKey();
        var pageData = data[key];

        if (!pageData) {
            pageData = data[key] = {
                query: {
                    SortBy: "SortName",
                    SortOrder: "Ascending",
                    IncludeItemTypes: "Series",
                    Recursive: true,
                    Fields: "DateCreated,ItemCounts",
                    StartIndex: 0,
                    Limit: LibraryBrowser.getDefaultPageSize()
                }
            };

            pageData.query.ParentId = LibraryMenu.getTopParentId();
            LibraryBrowser.loadSavedQueryValues(key, pageData.query);
        }
        return pageData.query;
    }

    function getSavedQueryKey() {

        return getWindowUrl();
    }

    function reloadItems(page) {

        var query = getQuery();

        Dashboard.showLoadingMsg();

        ApiClient.getStudios(Dashboard.getCurrentUserId(), query).done(function (result) {

            // Scroll back up so they can see the results from the beginning
            window.scrollTo(0, 0);

            var html = '';

            $('.listTopPaging', page).html(LibraryBrowser.getQueryPagingHtml({
                startIndex: query.StartIndex,
                limit: query.Limit,
                totalRecordCount: result.TotalRecordCount,
                viewButton: true,
                showLimit: false
            }));

            updateFilterControls(page);

            html += LibraryBrowser.getPosterViewHtml({
                items: result.Items,
                shape: "backdrop",
                showTitle: false,
                context: 'tv',
                preferThumb: true,
                showItemCounts: true,
                centerText: true,
                lazy: true

            });

            var elem = page.querySelector('#items');
            elem.innerHTML = html;
            ImageLoader.lazyChildren(elem);

            $('.btnNextPage', page).on('click', function () {
                query.StartIndex += query.Limit;
                reloadItems(page);
            });

            $('.btnPreviousPage', page).on('click', function () {
                query.StartIndex -= query.Limit;
                reloadItems(page);
            });

            LibraryBrowser.saveQueryValues(getSavedQueryKey(), query);

            LibraryBrowser.setLastRefreshed(page);
            Dashboard.hideLoadingMsg();
        });
    }

    function updateFilterControls(page) {

        var query = getQuery();

        $('.chkStandardFilter', page).each(function () {

            var filters = "," + (query.Filters || "");
            var filterName = this.getAttribute('data-filter');

            this.checked = filters.indexOf(',' + filterName) != -1;

        }).checkboxradio('refresh');

        $('#selectPageSize', page).val(query.Limit).selectmenu('refresh');
    }

    $(document).on('pageinitdepends', "#tvStudiosPage", function () {

        var page = this;

        $('.chkStandardFilter', this).on('change', function () {

            var query = getQuery();

            var filterName = this.getAttribute('data-filter');
            var filters = query.Filters || "";

            filters = (',' + filters).replace(',' + filterName, '').substring(1);

            if (this.checked) {
                filters = filters ? (filters + ',' + filterName) : filterName;
            }

            query.StartIndex = 0;
            query.Filters = filters;

            reloadItems(page);
        });

        $('#selectPageSize', page).on('change', function () {
            var query = getQuery();

            query.Limit = parseInt(this.value);
            query.StartIndex = 0;
            reloadItems(page);
        });

    }).on('pagebeforeshowready', "#tvStudiosPage", function () {

        var page = this;

        if (LibraryBrowser.needsRefresh(page)) {
            reloadItems(page);
        }

        updateFilterControls(page);
    });

})(jQuery, document);