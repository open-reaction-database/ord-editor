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

goog.module('ord.workups');
goog.module.declareLegacyNamespace();

const asserts = goog.require('goog.asserts');

const amounts = goog.require('ord.amounts');
const inputs = goog.require('ord.inputs');
const utils = goog.require('ord.utils');

const ReactionWorkup = goog.require('proto.ord.ReactionWorkup');
const WorkupType = goog.require('proto.ord.ReactionWorkup.WorkupType');
const StirringConditions = goog.require('proto.ord.StirringConditions');
const StirringMethodType = goog.require('proto.ord.StirringConditions.StirringMethodType');
const StirringRate = goog.require('proto.ord.StirringConditions.StirringRate');
const StirringRateType = goog.require('proto.ord.StirringConditions.StirringRate.StirringRateType');
const Temperature = goog.require('proto.ord.Temperature');
const TemperatureConditions = goog.require('proto.ord.TemperatureConditions');
const Measurement = goog.require('proto.ord.TemperatureConditions.Measurement');
const MeasurementType = goog.require('proto.ord.TemperatureConditions.Measurement.MeasurementType');
const TemperatureControl = goog.require('proto.ord.TemperatureConditions.TemperatureControl');
const TemperatureControlType = goog.require('proto.ord.TemperatureConditions.TemperatureControl.TemperatureControlType');
const Time = goog.require('proto.ord.Time');

exports = {
  load,
  unload,
  add,
  addMeasurement,
  validateWorkup
};

/**
 * Adds and populates the reaction workup sections in the form.
 * @param {!Array<!ReactionWorkup>} workups
 */
function load(workups) {
  workups.forEach(workup => loadWorkup(workup));
}

/**
 * Adds and populates a reaction workup section in the form.
 * @param {!ReactionWorkup} workup
 */
function loadWorkup(workup) {
  const node = add();
  utils.setSelector($('.workup_type', node), workup.getType());
  $('.workup_details', node).text(workup.getDetails());
  const duration = workup.getDuration();
  if (duration) {
    utils.writeMetric('.workup_duration', duration, node);
  }

  const input = workup.getInput();
  inputs.loadInputUnnamed($('.workup_input', node), input);

  const amount = workup.getAmount();
  amounts.load(node, amount);

  const temperature = workup.getTemperature();
  if (temperature) {
    const control = temperature.getControl();
    if (control) {
      utils.setSelector(
          $('.workup_temperature_control_type', node), control.getType());
      $('.workup_temperature_details', node).text(control.getDetails());
    }
    const setpoint = temperature.getSetpoint();
    if (setpoint) {
      utils.writeMetric('.workup_temperature_setpoint', setpoint, node);
    }

    temperature.getMeasurementsList().forEach(
        measurement => loadMeasurement(node, measurement));
  }

  $('.workup_keep_phase', node).text(workup.getKeepPhase());

  const stirring = workup.getStirring();
  if (stirring) {
    utils.setSelector(
        $('.workup_stirring_method_type', node), stirring.getType());
    $('.workup_stirring_method_details', node).text(stirring.getDetails());
    const rate = stirring.getRate();
    if (rate) {
      utils.setSelector($('.workup_stirring_rate_type', node), rate.getType());
      $('.workup_stirring_rate_details', node).text(rate.getDetails());
      const rpm = rate.getRpm();
      if (rpm !== 0) {
        $('.workup_stirring_rate_rpm', node).text(rpm);
      }
    }
  }
  if (workup.hasTargetPh()) {
    $('.workup_target_ph', node).text(workup.getTargetPh());
  }
  utils.setOptionalBool(
      $('.workup_automated', node),
      workup.hasIsAutomated() ? workup.getIsAutomated() : null);
}

/**
 * Loads a measurement into the given node in a workup.
 * @param {!jQuery} workupNode The div corresponding to the workup whose fields
 *     should be updated.
 * @param {!TemperatureConditions.Measurement} measurement
 */
function loadMeasurement(workupNode, measurement) {
  const node = addMeasurement(workupNode);
  utils.setSelector(
      $('.workup_temperature_measurement_type', node), measurement.getType());
  $('.workup_temperature_measurement_details', node)
      .text(measurement.getDetails());
  const time = measurement.getTime();
  if (time) {
    utils.writeMetric('.workup_temperature_measurement_time', time, node);
  }
  const temperature = measurement.getTemperature();
  if (temperature) {
    utils.writeMetric(
        '.workup_temperature_measurement_temperature', temperature, node);
  }
}

/**
 * Fetches a list of workups defined in the form.
 * @return {!Array<!ReactionWorkup>} workups
 */
function unload() {
  const workups = [];
  $('.workup').each(function(index, node) {
    node = $(node);
    if (!utils.isTemplateOrUndoBuffer(node)) {
      const workup = unloadWorkup(node);
      if (!utils.isEmptyMessage(workup)) {
        workups.push(workup);
      }
    }
  });
  return workups;
}

/**
 * Fetches a single workup from the form.
 * @param {!jQuery} node The div corresponding to the workup to fetch.
 * @return {!ReactionWorkup}
 */
function unloadWorkup(node) {
  const workup = new ReactionWorkup();
  const workupType = utils.getSelectorText($('.workup_type', node)[0]);
  workup.setType(WorkupType[workupType]);
  workup.setDetails(asserts.assertString($('.workup_details', node).text()));

  const duration = utils.readMetric('.workup_duration', new Time(), node);
  if (!utils.isEmptyMessage(duration)) {
    workup.setDuration(duration);
  }

  const input = inputs.unloadInputUnnamed(node);
  if (!utils.isEmptyMessage(input)) {
    workup.setInput(input);
  }

  const amount = amounts.unload($('.workup_amount', node));
  if (!utils.isEmptyMessage(amount)) {
    workup.setAmount(amount);
  }

  const control = new TemperatureControl();
  const temperatureControlType =
      utils.getSelectorText($('.workup_temperature_control_type', node)[0]);
  control.setType(TemperatureControlType[temperatureControlType]);
  control.setDetails(
      asserts.assertString($('.workup_temperature_details', node).text()));

  const temperature = new TemperatureConditions();
  if (!utils.isEmptyMessage(control)) {
    temperature.setControl(control);
  }

  const setpoint =
      utils.readMetric('.workup_temperature_setpoint', new Temperature(), node);
  if (!utils.isEmptyMessage(setpoint)) {
    temperature.setSetpoint(setpoint);
  }

  const measurements = [];
  const measurementNodes = $('.workup_temperature_measurement', node);
  measurementNodes.each(function(index, measurementNode) {
    measurementNode = $(measurementNode);
    if (!measurementNode.attr('id')) {
      // Not a template.
      const measurement = unloadMeasurement(measurementNode);
      if (!utils.isEmptyMessage(measurement)) {
        measurements.push(measurement);
      }
    }
  });
  temperature.setMeasurementsList(measurements);
  if (!utils.isEmptyMessage(temperature)) {
    workup.setTemperature(temperature);
  }
  workup.setKeepPhase(
      asserts.assertString($('.workup_keep_phase', node).text()));

  const stirring = new StirringConditions();
  const stirringMethodType =
      utils.getSelectorText($('.workup_stirring_method_type', node)[0]);
  stirring.setType(StirringMethodType[stirringMethodType]);
  stirring.setDetails(
      asserts.assertString($('.workup_stirring_method_details').text()));

  const rate = new StirringRate();
  const stirringRateType =
      utils.getSelectorText($('.workup_stirring_rate_type', node)[0]);
  rate.setType(StirringRateType[stirringRateType]);
  rate.setDetails(
      asserts.assertString($('.workup_stirring_rate_details').text()));
  const rpm = parseFloat($('.workup_stirring_rate_rpm', node).text());
  if (!isNaN(rpm)) {
    rate.setRpm(rpm);
  }
  if (!utils.isEmptyMessage(rate)) {
    stirring.setRate(rate);
  }

  if (!utils.isEmptyMessage(stirring)) {
    workup.setStirring(stirring);
  }

  const targetPh = parseFloat($('.workup_target_ph', node).text());
  if (!isNaN(targetPh)) {
    workup.setTargetPh(targetPh);
  }
  const isAutomated = utils.getOptionalBool($('.workup_automated', node));
  if (isAutomated !== null) {
    workup.setIsAutomated(isAutomated);
  }
  return workup;
}

/**
 * Fetches a single workup temperature measurement from the form.
 * @param {!jQuery} node The div corresponding to the measurement to fetch.
 * @return {!TemperatureConditions.Measurement}
 */
function unloadMeasurement(node) {
  const measurement = new Measurement();
  const measurementType =
      utils.getSelectorText($('.workup_temperature_measurement_type', node)[0]);
  measurement.setType(MeasurementType[measurementType]);
  measurement.setDetails(asserts.assertString(
      $('.workup_temperature_measurement_details', node).text()));
  const time = utils.readMetric(
      '.workup_temperature_measurement_time', new Time(), node);
  if (!utils.isEmptyMessage(time)) {
    measurement.setTime(time);
  }
  const temperature = utils.readMetric(
      '.workup_temperature_measurement_temperature', new Temperature(), node);
  if (!utils.isEmptyMessage(temperature)) {
    measurement.setTemperature(temperature);
  }
  return measurement;
}

/**
 * Adds a new reaction workup section to the form.
 * @return {!jQuery} The newly added parent node for the reaction workup.
 */
function add() {
  const workupNode = utils.addSlowly('#workup_template', $('#workups'));
  const inputNode = $('.workup_input', workupNode);
  // The template for ReactionWorkup.input is taken from Reaction.inputs.
  const workupInputNode = inputs.add(inputNode, ['workup_input']);
  // Adjust heading sizes. Start with the smallest so we don't adjust more than
  // once.
  // TODO(kearnes): This does not affect input components added later.
  $('.h5', workupInputNode).addClass('h6').removeClass('h5');
  $('.h4', workupInputNode).addClass('h5').removeClass('h4');
  $('.h3', workupInputNode).addClass('h4').removeClass('h3');
  // Workup inputs start collapsed by default.
  workupInputNode.find('.collapse').trigger('click');
  // Temperature conditions and stirring fields also start collapsed.
  workupNode.find('.workup_temperature').trigger('click');
  workupNode.find('.workup_temperature_measurements_wrap').trigger('click');
  workupNode.find('.workup_stirring').trigger('click');
  // Unlike Reaction.inputs, this ReactionInput has no name.
  $('.input_name', inputNode).hide();
  // Unlike Reaction.inputs, this ReactionInput is not repeated.
  $('.remove', inputNode).hide();

  amounts.init(workupNode);

  // Add live validation handling.
  utils.addChangeHandler(workupNode, () => {
    validateWorkup(workupNode);
  });

  return workupNode;
}

/**
 * Adds a new measurement section to the current workup in the form.
 * @param {!jQuery} node The workup div where the new measurement should be
 *     added.
 * @return {!jQuery} The node of the new measurement div.
 */
function addMeasurement(node) {
  return utils.addSlowly(
      '#workup_temperature_measurement_template',
      $('.workup_temperature_measurements', node));
}

/**
 * Validates a workup as defined in the form.
 * @param {!jQuery} node The div containing to the workup in the form.
 * @param {?jQuery=} validateNode The target div for validation results.
 */
function validateWorkup(node, validateNode = null) {
  const workup = unloadWorkup(node);
  utils.validate(workup, 'ReactionWorkup', node, validateNode);
}
