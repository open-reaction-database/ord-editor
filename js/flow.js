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

goog.module('ord.flows');
goog.module.declareLegacyNamespace();

const asserts = goog.require('goog.asserts');

const utils = goog.require('ord.utils');

const FlowConditions = goog.require('proto.ord.FlowConditions');
const FlowType = goog.require('proto.ord.FlowConditions.FlowType');
const FlowTypeEnum = goog.require('proto.ord.FlowConditions.FlowType.FlowTypeEnum');
const Tubing = goog.require('proto.ord.FlowConditions.Tubing');
const TubingMaterialType = goog.require('proto.ord.FlowConditions.Tubing.TubingMaterialType');
const Length = goog.require('proto.ord.Length');



exports = {
  load,
  unload,
  validateFlow
};

/**
 * Adds and populates the flow conditions section in the form.
 * @param {!FlowConditions} flow
 */
function load(flow) {
  const type = flow.getFlowType();
  if (type) {
    utils.setSelector($('#flow_type'), type.getType());
    $('#flow_details').text(type.getDetails());
  }
  $('#flow_pump').text(flow.getPumpType());

  const tubing = flow.getTubing();
  utils.setSelector($('#flow_tubing_type'), tubing.getType());
  $('#flow_tubing_details').text(tubing.getDetails());
  utils.writeMetric('#flow_tubing', tubing.getDiameter());
}

/**
 * Fetches the flow conditions defined in the form.
 * @return {!FlowConditions}
 */
function unload() {
  const flow = new FlowConditions();

  const type = new FlowType();
  const flowType = utils.getSelectorText($('#flow_type')[0]);
  type.setType(FlowTypeEnum[flowType]);
  type.setDetails(asserts.assertString($('#flow_details').text()));
  if (!utils.isEmptyMessage(type)) {
    flow.setFlowType(type);
  }

  flow.setPumpType(asserts.assertString($('#flow_pump').text()));

  const tubing = new Tubing();
  const tubingType = utils.getSelectorText($('#flow_tubing_type')[0]);
  tubing.setType(TubingMaterialType[tubingType]);
  tubing.setDetails(asserts.assertString($('#flow_tubing_details').text()));
  const diameter = utils.readMetric('#flow_tubing', new Length());
  if (!utils.isEmptyMessage(diameter)) {
    tubing.setDiameter(diameter);
  }

  if (!utils.isEmptyMessage(tubing)) {
    flow.setTubing(tubing);
  }
  return flow;
}

/**
 * Validates the flow conditions defined in the form.
 * @param {!jQuery} node Root node for the flow conditions.
 * @param {?jQuery=} validateNode Target node for validation results.
 */
function validateFlow(node, validateNode = null) {
  const flow = unload();
  utils.validate(flow, 'FlowConditions', node, validateNode);
}
