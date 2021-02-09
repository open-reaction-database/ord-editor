/**
 * Copyright 2020 Open Reaction Database Project Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

goog.module('ord.utils');
goog.module.declareLegacyNamespace();
exports = {
  addChangeHandler,
  addSlowly,
  checkFloat,
  checkInteger,
  compareDataset,
  getOptionalBool,
  getSelector,
  getSelectorText,
  initCollapse,
  initOptionalBool,
  initSelector,
  initValidateNode,
  isEmptyMessage,
  isTemplateOrUndoBuffer,
  prepareFloat,
  readMetric,
  removeSlowly,
  scrollToInput,
  selectText,
  setOptionalBool,
  setSelector,
  setTextFromFile,
  toggleValidateMessage,
  undoSlowly,
  validate,
  writeMetric,
};

goog.require('ord.enums');  // Used by nameToProto.
goog.require('proto.ord.Dataset');

const FLOAT_PATTERN = /^-?(?:\d+|\d+\.\d*|\d*\.\d+)(?:[eE]-?\d+)?$/;
const INTEGER_PATTERN = /^-?\d+$/;

/**
 * Selects the contents of the given node.
 * @param {!Node} node
 */
function selectText(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Determines if the text entered in a float input is valid by detecting any
 * characters besides 0-9, a single period to signify a decimal, and a
 * leading hyphen. Also supports scientific notation with either 'e' or 'E'.
 * @param {!Node} node
 */
function checkFloat(node) {
  const stringValue = $(node).text().trim();
  if (stringValue === '') {
    $(node).removeClass('invalid');
  } else if (FLOAT_PATTERN.test(stringValue)) {
    $(node).removeClass('invalid');
  } else {
    $(node).addClass('invalid');
  }
}

/**
 * Determines if the text entered in an integer input is valid by forbidding
 * any characters besides 0-9 and a leading hyphen.
 * @param {!Node} node
 */
function checkInteger(node) {
  const stringValue = $(node).text().trim();
  if (stringValue === '') {
    $(node).removeClass('invalid');
  } else if (INTEGER_PATTERN.test(stringValue)) {
    $(node).removeClass('invalid');
  } else {
    $(node).addClass('invalid');
  }
}

/**
 * Prepares a floating point value for display in the form.
 * @param {number} value
 * @return {number}
 */
function prepareFloat(value) {
  // Round to N significant digits; this avoid floating point precision issues
  // that can be quite jarring to users.
  //
  // See:
  //   * https://stackoverflow.com/a/3644302
  //   * https://medium.com/swlh/ed74c471c1b8
  //   * https://stackoverflow.com/a/19623253
  const precision = 7;
  return parseFloat(value.toPrecision(precision));
}

/**
 * Adds a jQuery handler to a node such that the handler is run once whenever
 * data entry within that node is changed, *except through remove* -- this must
 * be handled manually. (This prevents inconsistent timing in the ordering of
 * the element being removed and the handler being called.)
 * @param {!Node} node
 * @param {!Function} handler
 */
function addChangeHandler(node, handler) {
  // For textboxes
  node.on('blur', '.edittext', handler);
  // For selectors, optional bool selectors,
  // and checkboxes/radio buttons/file upload, respectively
  node.on('change', '.selector, .optional_bool, input', handler);
  // For add buttons
  node.on('click', '.add', handler);
}

/**
 * Generic validator for many message types, not just reaction.
 * NOTE: This function does not commit or save anything!
 * @param {!jspb.Message} message The proto to validate.
 * @param {string} messageTypeString The message type.
 * @param {!Node} node Parent node for the unloaded message.
 * @param {?Node} validateNode Target div for validation output.
 */
function validate(message, messageTypeString, node, validateNode) {
  // eg message is a type of reaction, messageTypeString = 'Reaction'
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/dataset/proto/validate/' + messageTypeString);
  const binary = message.serializeBinary();
  if (!validateNode) {
    validateNode = $('.validate', node).first();
  }
  xhr.responseType = 'json';
  xhr.onload = function() {
    const validationOutput = xhr.response;
    const errors = validationOutput.errors;
    const warnings = validationOutput.warnings;
    // Add client-side validation errors.
    $(node).find('.invalid').each(function(index) {
      const invalidName = $(this).attr('class').split(' ')[0];
      errors.push('Value for ' + invalidName + ' is invalid');
    });
    const statusNode = $('.validate_status', validateNode);
    const messageNode = $('.validate_message', validateNode);
    statusNode.removeClass('fa-check');
    statusNode.removeClass('fa-exclamation-triangle');
    statusNode.css('backgroundColor', null);
    statusNode.text('');
    if (errors.length) {
      statusNode.addClass('fa fa-exclamation-triangle');
      statusNode.css('color', 'red');
      statusNode.text(' ' + errors.length);
      messageNode.html('<ul></ul>');
      for (let index = 0; index < errors.length; index++) {
        const error = errors[index];
        const errorNode = $('<li></li>');
        errorNode.text(error);
        $('ul', messageNode).append(errorNode);
      }
      messageNode.css('backgroundColor', 'pink');
    } else {
      statusNode.addClass('fa fa-check');
      statusNode.css('color', 'green');
      messageNode.html('');
      messageNode.css('backgroundColor', '');
      messageNode.css('visibility', 'hidden');
    }
    const warningStatusNode = $('.validate_warning_status', validateNode);
    const warningMessageNode = $('.validate_warning_message', validateNode);
    if (warnings.length) {
      warningStatusNode.show();
      warningStatusNode.text(' ' + warnings.length);
      warningMessageNode.show();
      warningMessageNode.html('<ul></ul>');
      for (let index = 0; index < warnings.length; index++) {
        const warning = warnings[index];
        const warningNode = $('<li></li>');
        warningNode.text(warning);
        $('ul', warningMessageNode).append(warningNode);
      }
    } else {
      warningStatusNode.hide();
      warningMessageNode.html('');
      warningMessageNode.hide();
    }
  };
  xhr.send(binary);
}

/**
 * Toggles the visibility of the 'validate' button for a given node.
 * @param {!Node} node
 * @param {string} target Destination class for the validation message(s).
 */
function toggleValidateMessage(node, target) {
  let messageNode = $(target, node);
  switch (messageNode.css('visibility')) {
    case 'visible':
      messageNode.css('visibility', 'hidden');
      break;
    case 'hidden':
      messageNode.css('visibility', 'visible');
      break;
  }
}

/**
 * Compares a local Dataset to a Dataset on the server (used for testing).
 * @param {string} fileName The name of a dataset on the server.
 * @param {!proto.ord.Dataset} dataset A local Dataset.
 * @return {!Promise<!Uint8Array>}
 */
async function compareDataset(fileName, dataset) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/dataset/proto/compare/' + fileName);
    const binary = dataset.serializeBinary();
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject();
      }
    };
    xhr.onerror = reject;
    xhr.send(binary);
  });
}

/**
 * Checks if the argument represents an empty protobuf message (that is, the
 * argument's nested arrays only contains null or empty values), or is null or
 * undefined. We use this check on both primitives and arrays/messages.
 * NOTE: Unlike other primitive types, using a setter to set a oneof string
 * field to “” causes the message to include the field and “”, which would be
 * unwanted. So we instead claim that empty strings are empty messages. (Hence
 * we don’t set _any_ empty string.)
 * NOTE: In a submessage, setting a meaningful value (e.g. optional float to 0)
 * will result in a non-null/undefined value in the submessage array. So, if
 * the array of a submessage only contains null and undefined vals, we can
 * assume that the message is truly “empty” (that is, doesn’t have anything
 * meaningful that is set) and can be omitted when constructing the surrounding
 * message.
 * @param {!jspb.Message} obj The object to test.
 * @return {boolean} Whether the message is empty.
 */
function isEmptyMessage(obj) {
  const empty = new obj.constructor();
  // Compare binary encodings to cover optional fields.
  return JSON.stringify(obj.serializeBinary()) ===
      JSON.stringify(empty.serializeBinary());
}

/**
 * Adds an instance of `template` to the root node.
 * @param {string} template A jQuery selector.
 * @param {!Node} root A jQuery object.
 * @return {!Node} The new copy of the template.
 */
function addSlowly(template, root) {
  const node = $(template).clone();
  node.removeAttr('id');
  $(root).append(node);
  node.show('slow');
  ord.reaction.dirty();
  ord.reaction.listen(node);
  $('[data-toggle=\'tooltip\']', node).tooltip();
  return node;
}

/**
 * Removes from the DOM the nearest ancestor element matching the pattern.
 * @param {string} button The element from which to start the search.
 * @param {string} pattern The pattern for the element to remove.
 */
function removeSlowly(button, pattern) {
  const node = $(button).closest(pattern);
  // Must call necessary validators only after the node is removed,
  // but we can only figure out which validators these are before removal.
  // We do so, and after removal, click the corresponding buttons to trigger
  // validation.
  let buttonsToClick = $();
  node.parents('fieldset').each(function() {
    buttonsToClick =
        buttonsToClick.add($(this).children('legend').find('.validate_button'));
  });
  makeUndoable(node);
  node.hide('slow', function() {
    buttonsToClick.trigger('click');
    updateSidebar();
  });
  dirty();
}

/**
 * Reverses the hide() in the most recent invocation of removeSlowly().
 * Removes the node's "undo" button. Does not trigger validation.
 */
function undoSlowly() {
  $('.undoable').removeClass('undoable').show('slow');
  $('.undo').not('#undo_template').hide('slow', function() {
    $(this).remove();
    updateSidebar();
  });
  dirty();
}

/**
 * Marks the given node for possible future undo. Adds an "undo" button to do
 * it. Deletes any preexisting undoable nodes and undo buttons.
 * @param {!Node} node The DOM fragment to hide and re-show.
 */
function makeUndoable(node) {
  $('.undoable').remove();
  node.addClass('undoable');
  $('.undo').not('#undo_template').remove();
  const button = $('#undo_template').clone();
  button.removeAttr('id');
  node.after(button);
  button.show('slow');
}

/**
 * Supports unload() operations by filtering spurious selector matches due
 * either to DOM templates or elements the user has removed undoably.
 * @param {!Node node} node The DOM node to test for spuriousness.
 * @return {boolean} True means ignore this node.
 */
function isTemplateOrUndoBuffer(node) {
  return node.attr('id') || node.hasClass('undoable');
}

/**
 * Toggles the visibility of all siblings of an element, or if a pattern is
 * provided, toggles the visibility of all siblings of the nearest ancestor
 * element matching the pattern.
 * @param {!Node} node The element to toggle or use as the search root.
 * @param {string} pattern The pattern to match for finding siblings to toggle.
 */
//
function toggleSlowly(node, pattern) {
  node = $(node);
  if (pattern) {
    node = node.closest(pattern);
  }
  // 'collapsed' tag is used to hold previously collapsed siblings,
  // and would be stored as node's next sibling;
  // the following line checks whether a collapse has occured.
  if (node.next('collapsed').length !== 0) {
    // Need to uncollapse.
    const collapsedNode = node.next('collapsed');
    collapsedNode.toggle('slow', () => {
      collapsedNode.children().unwrap();
    });
  } else {
    // Need to collapse.
    node.siblings().wrapAll('<collapsed>');
    node.next('collapsed').toggle('slow');
  }
}

/**
 * Toggles the collapse of a section in the form.
 * @param {string} button The element to toggle.
 */
function collapseToggle(button) {
  $(button).toggleClass('fa-chevron-down fa-chevron-right');
  toggleSlowly(button, 'legend');
}

/**
 * Unpacks a (value, units, precision) tuple into the given type.
 * @param {string} prefix The prefix for element attributes.
 * @param {!jspb.Message} proto A protocol buffer with `value`, `precision`,
 *     and `units` fields.
 * @param {!Node} node The node containing the tuple.
 * @return {!jspb.Message} The updated protocol buffer. Note that the message
 *     is modified in-place.
 */
function readMetric(prefix, proto, node) {
  const value = parseFloat($(prefix + '_value', node).text());
  if (!isNaN(value)) {
    proto.setValue(value);
  }
  if (proto.setUnits) {
    // proto.ord.Percentage doesn't have units.
    proto.setUnits(getSelector($(prefix + '_units', node)));
  }
  const precision = parseFloat($(prefix + '_precision', node).text());
  if (!isNaN(precision)) {
    proto.setPrecision(precision);
  }
  return proto;
}

/**
 * Packs a (value, units, precision) tuple into form elements.
 * @param {string} prefix The prefix for element attributes.
 * @param {!jspb.Message} proto A protocol buffer with `value`, `precision`,
 *     and`units` fields.
 * @param {!Node} node The target node for the tuple.
 */
function writeMetric(prefix, proto, node) {
  if (!(proto)) {
    return;
  }
  if (proto.hasValue()) {
    $(prefix + '_value', node).text(proto.getValue());
  }
  if (proto.getUnits) {
    // proto.ord.Percentage doesn't have units.
    setSelector($(prefix + '_units', node), proto.getUnits());
  }
  if (proto.hasPrecision()) {
    $(prefix + '_precision', node).text(proto.getPrecision());
  }
}

/**
 * Prompts the user to upload a file and sets the target node text with its
 * contents.
 * @param {!Node} identifierNode The node to update with the file contents.
 * @param {string} valueClass The class containing `identifierNode`.
 */
function setTextFromFile(identifierNode, valueClass) {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = (event => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = readerEvent => {
      const contents = readerEvent.target.result;
      $('.' + valueClass, identifierNode).text(contents);
    };
  });
  input.click();
}

/**
 * Adds and populates a <select/> node according to its data-proto type
 * declaration.
 * @param {!Node} node A node containing a `data-proto` attribute.
 */
function initSelector(node) {
  const protoName = node.attr('data-proto');
  const protoEnum = nameToProto(protoName);
  if (!protoEnum) {
    console.log('missing require: "' + protoName + '"');
  }
  const types = Object.entries(protoEnum);
  const select = $('<select>');
  for (let i = 0; i < types.length; i++) {
    const option = $('<option>').text(types[i][0]);
    option.attr('value', types[i][1]);
    if (types[i][0] === 'UNSPECIFIED') {
      option.attr('selected', 'selected');
    }
    select.append(option);
  }
  node.append(select);
}

/**
 * Selects an <option/> under a <select/>.
 * @param {!Node} node A <select/> element.
 * @param {number} value
 */
function setSelector(node, value) {
  $('option', node).first().removeAttr('selected');
  $('option[value=' + value + ']', node).first().attr('selected', 'selected');
}

/**
 * Finds the selected <option/> and maps its text onto a proto Enum.
 * @param {!Node} node A <select/> element.
 * @return {number}
 */
function getSelector(node) {
  return parseInt($('select', node).first().val());
}

/**
 * Finds the selected <option/> and returns its text.
 * @param {!Node} node A node containing one or more <select/> elements.
 * @return {string}
 */
function getSelectorText(node) {
  const selectorElement = node.getElementsByTagName('select')[0];
  return selectorElement.options[selectorElement.selectedIndex].text;
}

/**
 * Sets up a three-way popup (true/false/unspecified).
 * @param {!Node} node Target node for the new <select/> element.
 */
function initOptionalBool(node) {
  const select = $('<select>');
  const options = ['UNSPECIFIED', 'TRUE', 'FALSE'];
  for (let i = 0; i < options.length; i++) {
    const option = $('<option>').text(options[i]);
    option.attr('value', options[i]);
    if (options[i] === 'UNSPECIFIED') {
      option.attr('selected', 'selected');
    }
    select.append(option);
  }
  node.append(select);
}

/**
 * Sets the value of a three-way popup (true/false/unspecified).
 * @param {!Node} node A node containing a three-way selector.
 * @param {boolean|null} value The value to select.
 */
function setOptionalBool(node, value) {
  $('option', node).removeAttr('selected');
  if (value === true) {
    $('option[value=TRUE]', node).attr('selected', 'selected');
  }
  if (value === false) {
    $('option[value=FALSE]', node).attr('selected', 'selected');
  }
  if (value == null) {
    $('option[value=UNSPECIFIED]', node).attr('selected', 'selected');
  }
}

/**
 * Fetches the value of a three-way popup (true/false/unspecified).
 * @param {!Node} node A node containing a three-way selector.
 * @return {boolean|null}
 */
function getOptionalBool(node) {
  const value = $('select', node).val();
  if (value === 'TRUE') {
    return true;
  }
  if (value === 'FALSE') {
    return false;
  }
  return null;
}

/**
 * Sets up and initializes a collapse button by adding attributes into a div in
 * reaction.html.
 * @param {!Node} node Target node for the new button.
 */
function initCollapse(node) {
  node.addClass('fa');
  node.addClass('fa-chevron-down');
  node.click(function() {
    collapseToggle(this);
  });
  if (node.hasClass('starts_collapsed')) {
    node.trigger('click');
  }
}

/**
 * Sets up a validator div (button, status indicator, error list, etc.) by
 * inserting contents into a div in reaction.html.
 * @param {!Node} oldNode Target node for the new validation elements.
 */
function initValidateNode(oldNode) {
  let newNode = $('#validate_template').clone();
  // Add attributes necessary for validation functions:
  // Convert the placeholder onclick method into the button's onclick method.
  $('.validate_button', newNode).attr('onclick', oldNode.attr('onclick'));
  oldNode.removeAttr('onclick');
  // Add an id to the button.
  if (oldNode.attr('id')) {
    $('.validate_button', newNode).attr('id', oldNode.attr('id') + '_button');
  }
  oldNode.append(newNode.children());
}

/**
 * Converts a Message_Field name from a data-proto attribute into a proto class.
 * @param {string} protoName Underscore-delimited protocol buffer field name,
 *     such as Reaction_provenance.
 * @return {?typeof jspb.Message}
 */
function nameToProto(protoName) {
  let clazz = proto.ord;
  protoName.split('_').forEach(function(name) {
    clazz = clazz[name];
    if (!clazz) {
      return null;
    }
  });
  return clazz;
}

/**
 * Converts an Enum name string to its protobuf member value.
 * @param {string} name A text representation of an enum member.
 * @param {!enum} protoEnum The protocol buffer enum to search.
 * @return {number}
 */
function stringToEnum(name, protoEnum) {
  return protoEnum[name];
}

/**
 * Scrolls the viewport to the selected input.
 * @param {!Event} event
 */
function scrollToInput(event) {
  const section = $(event.target).attr('input_name');
  const target = $('.input[input_name=\'' + section + '\']');
  target[0].scrollIntoView({behavior: 'smooth'});
}
