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

goog.module('ord.outcomes');
goog.module.declareLegacyNamespace();
exports = {
  load,
  unload,
  add,
  addAnalysis,
  addData,
  validateOutcome,
  validateAnalysis
};

goog.require('ord.data');
goog.require('ord.products');
goog.require('ord.utils');
goog.require('proto.ord.ReactionOutcome');

// Freely create radio button groups by generating new input names.
let radioGroupCounter = 0;

/**
 * Adds and populates the reaction outcome sections in the form.
 * @param {!Array<!proto.ord.ReactionOutcome>} outcomes
 */
function load(outcomes) {
  outcomes.forEach(outcome => loadOutcome(outcome));
}

/**
 * Adds and populates a reaction outcome section in the form.
 * @param outcome
 */
function loadOutcome(outcome) {
  const node = add();

  const time = outcome.getReactionTime();
  if (time != null) {
    ord.utils.writeMetric('.outcome_time', time, node);
  }
  const conversion = outcome.getConversion();
  if (conversion) {
    ord.utils.writeMetric('.outcome_conversion', outcome.getConversion(), node);
  }

  const analyses = outcome.getAnalysesMap();
  const names = analyses.stringKeys_();
  names.forEach(function(name) {
    const analysis = analyses.get(name);
    loadAnalysis(node, name, analysis);
  });

  const products = outcome.getProductsList();
  ord.products.load(node, products);
}

/**
 * Adds and populates a reaction analysis section in the form.
 * @param {!Node} outcomeNode Parent reaction outcome node.
 * @param {string} name The name of this analysis.
 * @param {!proto.ord.Analysis} analysis
 */
function loadAnalysis(outcomeNode, name, analysis) {
  const node = addAnalysis(outcomeNode);

  $('.outcome_analysis_name', node).text(name).trigger('input');

  ord.utils.setSelector($('.outcome_analysis_type', node), analysis.getType());
  const chmoId = analysis.getChmoId();
  if (chmoId != 0) {
    $('.outcome_analysis_chmo_id', node).text(analysis.getChmoId());
  }
  $('.outcome_analysis_details', node).text(analysis.getDetails());

  const dataMap = analysis.getDataMap();
  const dataNames = dataMap.stringKeys_();
  dataNames.forEach(function(name) {
    const data = dataMap.get(name);
    const dataNode = addData(node);
    loadData(dataNode, name, data);
  });

  $('.outcome_analysis_manufacturer', node)
      .text(analysis.getInstrumentManufacturer());
  const calibrated = analysis.getInstrumentLastCalibrated();
  if (calibrated) {
    $('.outcome_analysis_calibrated', node).text(calibrated.getValue());
  }
  ord.utils.setOptionalBool(
      $('.outcome_analysis_is_of_isolated_species', node),
      analysis.hasIsOfIsolatedSpecies() ? analysis.getIsOfIsolatedSpecies() :
                                          null);
}

/**
 * Adds and populates a data section in a reaction analysis.
 * @param {!Node} node Parent reaction analysis node.
 * @param {string} name The name of this Data record.
 * @param {!proto.ord.Data} data
 */
function loadData(node, name, data) {
  $('.outcome_data_name', node).text(name);
  ord.data.loadData(node, data);
}

/**
 * Fetches the reaction outcomes defined in the form.
 * @return {!Array<!proto.ord.ReactionOutcome>}
 */
function unload() {
  const outcomes = [];
  $('.outcome').each(function(index, node) {
    node = $(node);
    if (!ord.utils.isTemplateOrUndoBuffer(node)) {
      const outcome = unloadOutcome(node);
      if (!ord.utils.isEmptyMessage(outcome)) {
        outcomes.push(outcome);
      }
    }
  });
  return outcomes;
}

/**
 * Fetches a reaction outcome defined in the form.
 * @param {!Node} node Root node for the reaction outcome.
 * @return {!proto.ord.ReactionOutcome}
 */
function unloadOutcome(node) {
  const outcome = new proto.ord.ReactionOutcome();

  const time =
      ord.utils.readMetric('.outcome_time', new proto.ord.Time(), node);
  if (!ord.utils.isEmptyMessage(time)) {
    outcome.setReactionTime(time);
  }

  const conversion = ord.utils.readMetric(
      '.outcome_conversion', new proto.ord.Percentage(), node);
  if (!ord.utils.isEmptyMessage(conversion)) {
    outcome.setConversion(conversion);
  }

  const products = ord.products.unload(node);
  outcome.setProductsList(products);

  const analyses = outcome.getAnalysesMap();
  $('.outcome_analysis', node).each(function(index, node) {
    node = $(node);
    if (!ord.utils.isTemplateOrUndoBuffer(node)) {
      unloadAnalysis(node, analyses);
    }
  });
  return outcome;
}

/**
 * Fetches a reaction analysis defined in the form.
 * @param {!Node} analysisNode Root node for the reaction analysis.
 * @return {!proto.ord.Analysis}
 */
function unloadAnalysisSingle(analysisNode) {
  const analysis = new proto.ord.Analysis();
  analysis.setType(
      ord.utils.getSelector($('.outcome_analysis_type', analysisNode)));
  const chmoId = $('.outcome_analysis_chmo_id', analysisNode).text();
  if (!isNaN(chmoId)) {
    analysis.setChmoId(chmoId);
  }
  analysis.setDetails($('.outcome_analysis_details', analysisNode).text());

  const dataMap = analysis.getDataMap();
  $('.outcome_data', analysisNode).each(function(index, dataNode) {
    dataNode = $(dataNode);
    if (!dataNode.attr('id')) {
      unloadData(dataNode, dataMap);
    }
  });
  analysis.setInstrumentManufacturer(
      $('.outcome_analysis_manufacturer', analysisNode).text());
  const calibrated = new proto.ord.DateTime();
  calibrated.setValue($('.outcome_analysis_calibrated', analysisNode).text());
  if (!ord.utils.isEmptyMessage(calibrated)) {
    analysis.setInstrumentLastCalibrated(calibrated);
  }
  analysis.setIsOfIsolatedSpecies(ord.utils.getOptionalBool(
      $('.outcome_analysis_is_of_isolated_species', analysisNode)));

  return analysis;
}

/**
 * Fetches a reaction analysis defined in the form and adds it to `analyses`.
 * @param {!Node} analysisNode Root node for the reaction analysis.
 * @param {!jspb.Map<string, !proto.ord.Analysis>} analyses
 */
function unloadAnalysis(analysisNode, analyses) {
  const analysis = unloadAnalysisSingle(analysisNode);
  const name = $('.outcome_analysis_name', analysisNode).text();
  if (name || !ord.utils.isEmptyMessage(analysis)) {
    analyses.set(name, analysis);
  }
}

/**
 * Fetches a data record defined in the form and adds it to `dataMap`.
 * @param {!Node} node Root node for the Data record.
 * @param {!jspb.Map<string, !proto.ord.Data>} dataMap
 */
function unloadData(node, dataMap) {
  const name = $('.outcome_data_name', node).text();
  const data = ord.data.unloadData(node);
  if (name || !ord.utils.isEmptyMessage(data)) {
    dataMap.set(name, data);
  }
}

/**
 * Adds a reaction outcome section to the form.
 * @return {!Node} The newly added parent node for the reaction outcome.
 */
function add() {
  const node = ord.utils.addSlowly('#outcome_template', '#outcomes');
  // Add live validation handling.
  ord.utils.addChangeHandler(node, () => {
    validateOutcome(node);
  });
  return node;
}

/**
 * Adds a reaction analysis section to the form.
 * @param {!Node} node Parent reaction outcome node.
 * @return {!Node} The newly added parent node for the reaction analysis.
 */
function addAnalysis(node) {
  const analysisNode = ord.utils.addSlowly(
      '#outcome_analysis_template', $('.outcome_analyses', node));

  // Handle name changes.
  const nameNode = $('.outcome_analysis_name', analysisNode);
  nameNode.on('focusin', function() {
    // Store old value in val attribute.
    nameNode.data('val', nameNode.text());
  });
  nameNode.on('input', function() {
    const old_name = nameNode.data('val');
    const name = nameNode.text();
    // Remove old key.
    if (old_name) {
      // If any selector had this value selected, reset it.
      $('.analysis_key_selector', node).each(function() {
        if ($(this).val() == old_name) {
          $(this).val('');
        }
      });
      $('.analysis_key_selector option[value="' + old_name + '"]', node)
          .remove();
    }
    // Add new key.
    if (name) {
      $('.analysis_key_selector', node)
          .append('<option value="' + name + '">' + name + '</option>');
      // Ensure old value stored (necessary if focus does not change).
      nameNode.data('val', name);
    }
  });

  // Add live validation handling.
  ord.utils.addChangeHandler(analysisNode, () => {
    validateAnalysis(analysisNode);
  });
  return analysisNode;
}

/**
 * Adds a new data section to the form.
 * @param {!Node} node Parent reaction outcome node.
 * @return {!Node} The newly added parent node for the Data record.
 */
function addData(node) {
  const processNode = ord.utils.addSlowly(
      '#outcome_data_template', $('.outcome_data_repeated', node));
  ord.data.addData(processNode);
  return processNode;
}

/**
 * Validates a reaction outcome defined in the form.
 * @param {!Node} node Root node for the reaction outcome.
 * @param {?Node} validateNode The target node for validation results.
 */
function validateOutcome(node, validateNode = null) {
  const outcome = unloadOutcome(node);
  ord.utils.validate(outcome, 'ReactionOutcome', node, validateNode);
}

/**
 * Validates a reaction analysis defined in the form.
 * @param {!Node} node Root node for the reaction analysis.
 * @param {?Node} validateNode The target node for validation results.
 */
function validateAnalysis(node, validateNode = null) {
  const analysis = unloadAnalysisSingle(node);
  ord.utils.validate(analysis, 'Analysis', node, validateNode);
}
