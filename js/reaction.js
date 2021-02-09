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

goog.module('ord.reaction');
goog.module.declareLegacyNamespace();
exports = {
  commit,
  downloadReaction,
  freeze,
  initFromDataset,
  initFromReactionId,
  setupObserver,
  toggleAutosave,
  undoSlowly,
  unloadReaction,
  updateSidebar,
  validateReaction,
};

goog.require('ord.conditions');
goog.require('ord.electro');
goog.require('ord.flows');
goog.require('ord.identifiers');
goog.require('ord.illumination');
goog.require('ord.inputs');
goog.require('ord.notes');
goog.require('ord.observations');
goog.require('ord.outcomes');
goog.require('ord.pressure');
goog.require('ord.provenance');
goog.require('ord.setups');
goog.require('ord.stirring');
goog.require('ord.temperature');
goog.require('ord.uploads');
goog.require('ord.utils');
goog.require('ord.workups');
goog.require('proto.ord.Reaction');

// Remember the dataset and reaction we are editing.
const session = {
  fileName: null,
  dataset: null,
  index: null,             // Ordinal position of the Reaction in its Dataset.
  observer: null,          // IntersectionObserver used for the sidebar.
  navSelectors: {},        // Dictionary from navigation to section.
  timers: {'short': null}  // A timer used by autosave.
};
// Export session, because it's used by test.js.
exports.session = session;

/**
 * Initializes the form.
 * @param {!proto.ord.Reaction} reaction Reaction proto to load.
 */
function init(reaction) {
  // Initialize all the template popup menus.
  $('.selector').each((index, node) => initSelector($(node)));
  $('.optional_bool').each((index, node) => initOptionalBool($(node)));
  // Enable all the editable text fields.
  $('.edittext').attr('contentEditable', 'true');
  // Initialize all the validators.
  $('.validate').each((index, node) => initValidateNode($(node)));
  // Initialize validation handlers that don't go in "add" methods.
  initValidateHandlers();
  // Initailize tooltips.
  $('[data-toggle=\'tooltip\']').tooltip();
  // Prevent tooltip pop-ups from blurring.
  // (see github.com/twbs/bootstrap/issues/22610)
  Popper.Defaults.modifiers.computeStyle.gpuAcceleration = false;
  // Show "save" on modifications.
  ord.utils.listen('body');
  // Load Ketcher content into an element with attribute role="application".
  document.getElementById('ketcher-iframe').contentWindow.ketcher.initKetcher();
  // Initialize the UI with the Reaction.
  loadReaction(reaction);
  ord.utils.clean();
  // Initialize the collaped/uncollapsed state of the fieldset groups.
  $('.collapse').each((index, node) => initCollapse($(node)));
  // Trigger reaction-level validation.
  validateReaction();
  // Initialize autosave being on.
  toggleAutosave();
  // Signal to tests that the DOM is initialized.
  ready();
}

/**
 * Initializes the form from a Dataset name and Reaction index.
 * @param {string} fileName Path to a Dataset proto.
 * @param {number} index The index of this Reaction in the Dataset.
 */
async function initFromDataset(fileName, index) {
  session.fileName = fileName;
  session.index = index;
  // Fetch the Dataset containing the Reaction proto.
  session.dataset = await ord.utils.getDataset(fileName);
  const reaction = session.dataset.getReactionsList()[index];
  init(reaction);
}

/**
 * Initializes the form from a Reaction ID.
 * @param {string} reactionId
 */
async function initFromReactionId(reactionId) {
  const reaction = await ord.utils.getReactionById(reactionId);
  // NOTE(kearnes): Without this next line, `reaction` will be
  // partial/incomplete, and I have no idea why.
  console.log(reaction.toObject());
  init(reaction);
  $('#dataset_context').hide();
}

/**
 * Sets the `ready` value to true.
 */
function ready() {
  $('body').attr('ready', true);
}

/**
 * Clicks the 'save' button if ready for a save.
 */
function clickSave() {
  // Only save if there are unsaved changes still to be saved -- hence save
  // button visible -- and if ready for a save (not in the process of saving
  // already).
  const saveButton = $('#save');
  if (saveButton.css('visibility') === 'visible' &&
      saveButton.text() === 'save') {
    saveButton.click();
  }
}

/**
 * Toggles autosave being active.
 */
function toggleAutosave() {
  // We keep track of timers by holding references, only if they're active.
  if (!session.timers.short) {
    // Enable a simple timer that saves periodically.
    session.timers.short =
        setInterval(clickSave, 1000 * 15);  // Save after 15 seconds
    $('#toggle_autosave').text('autosave: on');
    $('#toggle_autosave').css('backgroundColor', 'lightgreen');
  } else {
    // Stop the interval timer itself, then remove reference in order to
    // properly later detect that it's stopped.
    clearInterval(session.timers.short);
    session.timers.short = null;
    $('#toggle_autosave').text('autosave: off');
    $('#toggle_autosave').css('backgroundColor', 'pink');
  }
}

/**
 * Updates the visual summary of the current reaction.
 * @param {!proto.ord.Reaction} reaction
 */
function renderReaction(reaction) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/render/reaction');
  const binary = reaction.serializeBinary();
  xhr.responseType = 'json';
  xhr.onload = function() {
    const html_block = xhr.response;
    $('#reaction_render').html(html_block);
  };
  xhr.send(binary);
}

/**
 * Validates the current reaction.
 */
function validateReaction() {
  const node = $('#sections');
  const validateNode = $('#reaction_validate');
  const reaction = unloadReaction();
  ord.utils.validate(reaction, 'Reaction', node, validateNode);
  // Trigger all submessages to validate.
  $('.validate_button:visible:not(#reaction_validate_button)').trigger('click');
  // Render reaction as an HTML block.
  renderReaction(reaction);
}

/**
 * Writes the current reaction to disk.
 */
function commit() {
  if (!session.dataset) {
    // Do nothing when there is no Dataset; e.g. when viewing reactions by ID.
    return;
  }
  const reaction = unloadReaction();
  const reactions = session.dataset.getReactionsList();
  reactions[session.index] = reaction;
  putDataset(session.fileName, session.dataset);
  ord.uploads.putAll(session.fileName);
}

/**
 * Downloads the current reaction as a serialized Reaction proto.
 */
function downloadReaction() {
  const reaction = unloadReaction();
  const binary = reaction.serializeBinary();
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/reaction/download');
  xhr.onload = () => {
    // Make the browser write the file.
    const url = URL.createObjectURL(new Blob([xhr.response]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'reaction.pbtxt');
    document.body.appendChild(link);
    link.click();
  };
  xhr.send(binary);
}

/**
 * Uploads a serialized Dataset proto.
 * @param {string} fileName The name of the new dataset.
 * @param {!proto.ord.Dataset} dataset
 */
function putDataset(fileName, dataset) {
  $('#save').text('saving');
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/dataset/proto/write/' + fileName);
  const binary = dataset.serializeBinary();
  xhr.onload = ord.utils.clean;
  xhr.send(binary);
}

/**
 * Adds and populates the form with the given reaction.
 * @param {!proto.ord.Reaction} reaction
 */
function loadReaction(reaction) {
  const identifiers = reaction.getIdentifiersList();
  ord.identifiers.load(identifiers);
  const inputs = reaction.getInputsMap();
  // Reactions start with an input by default.
  if (inputs.arr_.length) {
    ord.inputs.load(inputs);
  } else {
    ord.inputs.add('#inputs');
  }
  const setup = reaction.getSetup();
  if (setup) {
    ord.setups.load(setup);
  }
  const conditions = reaction.getConditions();
  if (conditions) {
    ord.conditions.load(conditions);
  }
  const notes = reaction.getNotes();
  if (notes) {
    ord.notes.load(notes);
  }
  const observations = reaction.getObservationsList();
  ord.observations.load(observations);

  const workups = reaction.getWorkupsList();
  ord.workups.load(workups);

  const outcomes = reaction.getOutcomesList();
  // Reactions start with an outcome by default.
  if (outcomes.length) {
    ord.outcomes.load(outcomes);
  } else {
    ord.outcomes.add();
  }

  const provenance = reaction.getProvenance();
  if (provenance) {
    ord.provenance.load(provenance);
  }
  $('#reaction_id').text(reaction.getReactionId());

  // Clean up floating point entries.
  $('.floattext').each(function() {
    const node = $(this);
    if (node.text() !== '') {
      node.text(ord.utils.prepareFloat(parseFloat(node.text())));
    }
  });
}

/**
 * Fetches the current reaction from the form.
 * @return {!proto.ord.Reaction}
 */
function unloadReaction() {
  const reaction = new proto.ord.Reaction();
  const identifiers = ord.identifiers.unload();
  reaction.setIdentifiersList(identifiers);

  const inputs = reaction.getInputsMap();
  // isEmptyMessage check occurs in inputs.unload.
  ord.inputs.unload(inputs);

  const setup = ord.setups.unload();
  if (!ord.utils.isEmptyMessage(setup)) {
    reaction.setSetup(setup);
  }

  const conditions = ord.conditions.unload();
  if (!ord.utils.isEmptyMessage(conditions)) {
    reaction.setConditions(conditions);
  }

  const notes = ord.notes.unload();
  if (!ord.utils.isEmptyMessage(notes)) {
    reaction.setNotes(notes);
  }

  const observations = ord.observations.unload();
  reaction.setObservationsList(observations);

  const workups = ord.workups.unload();
  reaction.setWorkupsList(workups);

  const outcomes = ord.outcomes.unload();
  reaction.setOutcomesList(outcomes);

  const provenance = ord.provenance.unload();
  if (!ord.utils.isEmptyMessage(provenance)) {
    reaction.setProvenance(provenance);
  }

  // Setter does nothing when passed an empty string.
  reaction.setReactionId($('#reaction_id').text());
  return reaction;
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
  ord.utils.dirty();
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
 * Toggles the visibility of all siblings of an element, or if a pattern is
 * provided, toggles the visibility of all siblings of the nearest ancestor
 * element matching the pattern.
 * @param {!Node} node The element to toggle or use as the search root.
 * @param {string} pattern The pattern to match for finding siblings to toggle.
 */
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
 * Adds and populates a <select/> node according to its data-proto type
 * declaration.
 * @param {!Node} node A node containing a `data-proto` attribute.
 */
function initSelector(node) {
  const protoName = node.attr('data-proto');
  const protoEnum = ord.utils.nameToProto(protoName);
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
 * Initializes the validation handlers. Some nodes are dynamically added or
 * removed; we add their validation handlers when the nodes themselves are
 * added. However, other nodes are always present in the HTML, and aren't
 * dynamically added nor removed. We add live validation to these nodes here.
 */
function initValidateHandlers() {
  // For setup
  const setupNode = $('#section_setup');
  ord.utils.addChangeHandler(setupNode, () => {
    ord.setups.validateSetup(setupNode);
  });

  // For conditions
  const conditionNode = $('#section_conditions');
  ord.utils.addChangeHandler(conditionNode, () => {
    ord.conditions.validateConditions(conditionNode);
  });

  // For temperature
  const temperatureNode = $('#section_conditions_temperature');
  ord.utils.addChangeHandler(temperatureNode, () => {
    ord.temperature.validateTemperature(temperatureNode);
  });

  // For pressure
  const pressureNode = $('#section_conditions_pressure');
  ord.utils.addChangeHandler(pressureNode, () => {
    ord.pressure.validatePressure(pressureNode);
  });

  // For stirring
  const stirringNode = $('#section_conditions_stirring');
  ord.utils.addChangeHandler(stirringNode, () => {
    ord.stirring.validateStirring(stirringNode);
  });

  // For illumination
  const illuminationNode = $('#section_conditions_illumination');
  ord.utils.addChangeHandler(illuminationNode, () => {
    ord.illumination.validateIllumination(illuminationNode);
  });

  // For electro
  const electroNode = $('#section_conditions_electro');
  ord.utils.addChangeHandler(electroNode, () => {
    ord.electro.validateElectro(electroNode);
  });

  // For flow
  const flowNode = $('#section_conditions_flow');
  ord.utils.addChangeHandler(flowNode, () => {
    ord.flows.validateFlow(flowNode);
  });

  // For notes
  const notesNode = $('#section_notes');
  ord.utils.addChangeHandler(notesNode, () => {
    ord.notes.validateNotes(notesNode);
  });

  // For provenance
  const provenanceNode = $('#section_provenance');
  ord.utils.addChangeHandler(provenanceNode, () => {
    ord.provenance.validateProvenance(provenanceNode);
  });
}

/**
 * Switches the UI into a read-only mode. This is irreversible.
 */
function freeze() {
  // Hide the header buttons...
  $('#header_buttons').children().hide();
  // ...except for "download".
  $('#download').show();
  $('#identity').hide();
  $('select').attr('disabled', 'true');
  $('input:radio').prop('disabled', 'true');
  $('.validate').hide();
  $('.add').hide();
  $('.remove').hide();
  $('.text_upload').hide();
  $('#provenance_created button').hide();
  $('.edittext').each((i, x) => {
    const node = $(x);
    node.attr('contenteditable', 'false');
    node.css('background-color', '#ebebe4');
  });
}

/**
 * Highlights navigation buttons in the sidebar corresponding to visible
 * sections. Used as a callback function for the IntersectionObserver.
 * @param {!Array<!IntersectionObserverEntry>} entries
 */
function observerCallback(entries) {
  entries.forEach(entry => {
    const target = $(entry.target);
    let section;
    if (target[0].hasAttribute('input_name')) {
      section = target.attr('input_name');
    } else {
      section = target.attr('id').split('_')[1];
    }
    if (entry.isIntersecting) {
      session.navSelectors[section].css('background-color', 'lightblue');
    } else {
      session.navSelectors[section].css('background-color', '');
    }
  });
}

/**
 * Sets up the IntersectionObserver used to highlight navigation buttons
 * in the sidebar.
 */
function setupObserver() {
  const headerSize = $('#header').outerHeight();
  const observerOptions = {rootMargin: '-' + headerSize + 'px 0px 0px 0px'};
  session.observer =
      new IntersectionObserver(observerCallback, observerOptions);
  updateObserver();
}

/**
 * Updates the set of elements watched by the IntersectionObserver.
 */
function updateObserver() {
  if (!session.observer) {
    return;  // Do nothing until setupObserver has been run.
  }
  session.observer.disconnect();
  $('.section:visible').not('.workup_input').each(function() {
    session.observer.observe(this);
  });
  // Index the selector controls.
  session.navSelectors = {};
  $('.navSection').each((index, selector) => {
    selector = $(selector);
    const section = selector.attr('data-section');
    session.navSelectors[section] = selector;
  });
  $('.inputNavSection').each((index, selector) => {
    selector = $(selector);
    const section = selector.attr('input_name');
    session.navSelectors[section] = selector;
  });
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

/**
 * Updates the input entries in the sidebar.
 */
function updateSidebar() {
  $('#navInputs').empty();
  $('.input:visible').not('.workup_input').each(function(index) {
    const node = $(this);
    let name = node.find('.input_name').first().text();
    if (name === '') {
      name = '(Input #' + (index + 1) + ')';
    }
    node.attr('input_name', 'INPUT-' + name);
    const navNode = $('<div>&#8226; ' + name + '</div>');
    navNode.addClass('inputNavSection');
    navNode.attr('input_name', 'INPUT-' + name);
    $('#navInputs').append(navNode);
    navNode.click(scrollToInput);
  });
  updateObserver();
}
