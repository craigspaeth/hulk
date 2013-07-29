(function($) {
    var DEFAULT_SEPARATOR = "=>";


    /**
     * Return a jQuery element for a save button
     */
    var getSaveButton = function() {
        var button = document.createElement('button');
        button.setAttribute('id', 'hulk-save');
        button.innerHTML = 'Save';
        return button;
    };

    /**********************      Handlers      ******************************/

    var attachSaveHandler = function(button, callback) {
        $(button).on('click', callback);
    };

    var attachCollapseHandler = function(button) {
        $(button).on('click', function(e) {
            e.preventDefault();
            var value = $(button).next();
            if ($(button).hasClass('collapsed')) {
                // Expand it
                $(button).text('Collapse');
                $(value).slideDown('slow', function() {
                    $(button).removeClass('collapsed');
                });
            } else {
                $(value).slideUp('slow', function() {
                    $(button).addClass('collapsed');
                    $(button).text('Expand');
                });
            }
        });
    };

    var attachAddArrayElementHandler = function(button, options) {
        $(button).on('click', function(e) {
            e.preventDefault();
            var elementHTML = createArrayElementHTML("", options);
            $(button).before(elementHTML);
        });
    };

    /**********************      Utilities      ******************************/
    /**
     * Detect whether a string is a number-ish value
     *
     * @param n string
     * @return boolean Whether the string is a number
     */
    var isNumber = function(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    };

    /**
     * Detect whether an object is a dictionary (eg, {}) instead of a list or
     * another data type
     *
     * Implementation taken from goog.typeOf here:
     * docs.closure-library.googlecode.com/git/closure_goog_base.js.source.html
     */
    var isDictionary = function(obj) {
        return typeof obj === "object" && ! (obj instanceof Array);
    };

    /**
     * Detect whether a list is a list of dictionaries
     *
     * Of course in Javascript a list can combine any types, in this case we are
     * strict and care only if the list is made up entirely of dictionaries. You
     * shouldn't mix types in a list.
     */
    var isArrayOfDictionaries = function(list) {
        try {
            return list.filter(isDictionary).length === list.length;
        } catch (TypeError) {
            return false;
        }
    };

    /*****************      Recursive Builder Functions      ******************/

    /**
     * Create HTML from a JSON array element
     *
     * @return the element as HTML, plus whatever is inside it
     */
    var createArrayElementHTML = function(element, options) {
        var elementHTML = $(document.createElement('div'));
        elementHTML.addClass('hulk-array-element');
        elementHTML.html(convertMapToHTML(element, options));
        return elementHTML;
    };

    var createArrayHTML = function(data, options) {
        var array = $(document.createElement('div'));
        array.addClass('hulk-array');
        for (var i = 0; i < data.length; i++) {
            var elementHTML = createArrayElementHTML(data[i], options);
            array.append(elementHTML);
        }
        // If it's a list of dictionaries, add an option to add
        // a dictionary.
        if (isArrayOfDictionaries(data)) {
            var addPairElement = $(document.createElement('button'));
            addPairElement.addClass('hulk-array-add-pair');
            addPairElement.text('Add key/value pair');
            array.append(addPairElement);
        } else {
            // Otherwise, you can only add new values.
            var addRowElement = $(document.createElement('button'));
            addRowElement.addClass('hulk-array-add-row');
            addRowElement.text('Add element');
            attachAddArrayElementHandler(addRowElement);
            array.append(addRowElement);
        }
        return array;
    };

    /**
     * Convert a JSON object into HTML
     *
     * This function calls itself recursively
     */
    var convertMapToHTML = function(data, options) {
        var separator;
        if (typeof options === "undefined") {
            separator = DEFAULT_SEPARATOR;
        } else {
            if (typeof options.separator !== "undefined") {
                separator = options.separator;
            } else {
                separator = DEFAULT_SEPARATOR;
            }
        }

        var type = typeof data;
        // typeof null === "object", so we compare directly against null
        if (type === "string" || type === "number" || type === "boolean" || data === null) {
            var valueInput = $(document.createElement('input'));
            valueInput.addClass('hulk-map-value');
            valueInput.attr('value', data);
            return valueInput;
        }

        // javascript you're drunk. http://stackoverflow.com/a/4775737/329700
        if (Object.prototype.toString.call(data) === '[object Array]') {
            return createArrayHTML(data, options);
        }

        // Now that we've covered the other cases, only dictionaries should be
        // left.
        var map = $(document.createElement('div'));
        map.addClass('hulk-map');

        // ugh, http://stackoverflow.com/q/5467129/329700
        var keys = [];
        for (var k in data) {
            if (data.hasOwnProperty(k)) {
                keys.push(k);
            }
        }

        keys.sort();

        for (var j = 0; j < keys.length; j++) {
            var key = keys[j];
            var value = data[key];
            var pair = $(document.createElement('div'));
            pair.addClass('hulk-map-pair');

            var keyHtml = $(document.createElement('input'));
            keyHtml.addClass('hulk-map-key');
            keyHtml.attr('value', key);
            pair.append(keyHtml);

            var separatorElement = $(document.createElement('p'));
            separatorElement.addClass('hulk-separator');
            separatorElement.text(separator);
            pair.append(separatorElement);

            var valueHtml = convertMapToHTML(value, options);
            valueHtml.addClass('hulk-map-value-container');
            if (valueHtml.children('.hulk-map-pair,.hulk-array-element').length > 0) {
                var button = $(document.createElement('button'));
                button.addClass('hulk-collapse-item');
                button.text("Collapse");
                attachCollapseHandler(button);
                pair.append(button);
            }
            pair.append(valueHtml);

            map.append(pair);
        }
        return map;
    };

    /**
     * this function calls itself recursively
     *
     * input: a JQuery object (the editor in JSON)
     * output: a JSON object
     */
    var reassembleJSON = function(html, options) {
        var emptyString;
        if (typeof options === "undefined") {
            emptyString = false;
        } else {
            if (typeof options.emptyString !== "undefined") {
                emptyString = options.emptyString;
            } else {
                emptyString = false;
            }
        }
        var mapChildren = html.children('.hulk-map');
        if (mapChildren.length > 0) {
            return reassembleJSON(mapChildren, options);
        }

        var mapItems = html.children('.hulk-map-pair');
        if (mapItems.length > 0) {
            var d = {};
            mapItems.each(function(index, element) {
                var $element = $(element);
                var key = $element.children('.hulk-map-key');
                // XXX if multiple elements have the same key, last one wins.
                // what should actually be done here? warn?
                d[key.val()] = reassembleJSON(
                    $element.children('.hulk-map-value-container'), options);
            });
            return d;
        }

        var arrayChildren = html.children('.hulk-array');
        if (arrayChildren.length > 0) {
            return reassembleJSON(arrayChildren, options);
        }

        if (html.hasClass('hulk-array')) {
            var array = [];
            html.children('.hulk-array-element').each(function(index, element) {
                array.push(reassembleJSON($(element), options));
            });
            return array;
        }

        if (html.hasClass('hulk-map-value')) {
            var value = html.val();

            // XXX: the JSON specification allows for fractions and exponents
            if (isNumber(value)) {
                return parseFloat(value);
            }

            if (value === "true") {
                return true;
            }
            if (value === "false") {
                return false;
            }

            /**
             * Note: there's some data loss here as we cannot detect between
             * the empty string and null. In theory we could attach a data-*
             * attribute to the input and use that but you'd still break if the
             * user voided a field while editing the JSON.
             *
             * XXX Probably the best thing to do here is allow the user to
             * pick what they want (empty string or null) here.
             */
            if (value === null || value === "null") {
                return null;
            }
            if (value.length === 0) {
                return emptyString === true ? "" : null;
            }

            return html.val();
        }

        // hack, merge this with the above conditional
        var valueChild = html.children('.hulk-map-value');
        if (valueChild.length) {
            return reassembleJSON(valueChild, options);
        }

        if (html.hasClass('hulk-map-value-container')) {
            return reassembleJSON(html.children('.hulk-map-value'), options);
        }

        return {};
    };

    /*********************      Exported Functions       **********************/

    $.hulk = function(selector, data, callback, options) {
        // get option settings
        var $element = $(selector);
        $element.addClass('hulk');
        if ($element.length === 0) {
            // XXX console doesn't always exist
            console.error("Attempting to hulk-ify element with selector " +
                selector + " failed because the element does not exist. " +
                "Quitting");
            return;
        }
        var html = convertMapToHTML(data, options);
        var button = getSaveButton();
        attachSaveHandler(button, function() {
            var newData = reassembleJSON($element.children(), options);
            callback(newData);
        });
        $element.html(html);
        $element.append(button);
        return $element;
    };

    $.hulkSmash = function(selector, options) {
        return reassembleJSON($(selector), options);
    };
}(jQuery));
