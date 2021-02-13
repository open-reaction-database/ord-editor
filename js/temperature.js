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

goog.module('ord.temperature');
goog.module.declareLegacyNamespace();

const asserts = goog.require('goog.asserts');

const utils = goog.require('ord.utils');

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
  addMeasurement,
  validateTemperature
};

/**
 * Adds and populates the temperature conditions section in the form.
 * @param {!TemperatureConditions} temperature
 */
function load(temperature) {
  const control = temperature.getControl();
  if (control) {
    utils.setSelector($('#temperature_control'), control.getType());
    $('#temperature_control_details').text(control.getDetails());
  }
  const measurements = temperature.getMeasurementsList();
  measurements.forEach(function(measurement) {
    const node = addMeasurement();
    loadMeasurement(measurement, node);
  });
  const setpoint = temperature.getSetpoint();
  utils.writeMetric('#temperature_setpoint', setpoint);
}

/**
 * Adds and populates a temperature measurement section in the form.
 * @param {!TemperatureConditions.Measurement} measurement
 * @param {!jQuery} node The target div.
 */
function loadMeasurement(measurement, node) {
  const type = measurement.getType();
  utils.setSelector($('.temperature_measurement_type', node), type);
  $('.temperature_measurement_details', node).text(measurement.getDetails());

  const temperature = measurement.getTemperature();
  utils.writeMetric('.temperature_measurement_temperature', temperature, node);

  const time = measurement.getTime();
  utils.writeMetric('.temperature_measurement_time', time, node);
}

/**
 * Fetches temperature conditions from the form.
 * @return {!TemperatureConditions}
 */
function unload() {
  const temperature = new TemperatureConditions();

  const control = new TemperatureControl();
  const controlType = utils.getSelectorText($('#temperature_control')[0]);
  control.setType(TemperatureControlType[controlType]);
  control.setDetails(asserts.assertString($('#temperature_control_details').text()));
  if (!utils.isEmptyMessage(control)) {
    temperature.setControl(control);
  }

  const setpoint = utils.readMetric('#temperature_setpoint', new Temperature());
  if (!utils.isEmptyMessage(setpoint)) {
    temperature.setSetpoint(setpoint);
  }

  const measurements = [];
  $('.temperature_measurement').each(function(index, node) {
    node = $(node);
    if (!utils.isTemplateOrUndoBuffer(node)) {
      const measurement = unloadMeasurement(node);
      if (!utils.isEmptyMessage(measurement)) {
        measurements.push(measurement);
      }
    }
  });
  temperature.setMeasurementsList(measurements);
  return temperature;
}

/**
 * Fetches a temperature measurement from the form.
 * @param {!jQuery} node The div of the measurement to fetch.
 * @return {!TemperatureConditions.Measurement}
 */
function unloadMeasurement(node) {
  const measurement = new Measurement();
  const measurementType = utils.getSelectorText($('.temperature_measurement_type', node)[0]);
  measurement.setType(MeasurementType[measurementType]);
  measurement.setDetails(asserts.assertString($('.temperature_measurement_details', node).text()));
  const temperature = utils.readMetric(
      '.temperature_measurement_temperature', new Temperature(), node);
  if (!utils.isEmptyMessage(temperature)) {
    measurement.setTemperature(temperature);
  }
  const time =
      utils.readMetric('.temperature_measurement_time', new Time(), node);
  if (!utils.isEmptyMessage(time)) {
    measurement.setTime(time);
  }
  return measurement;
}

/**
 * Adds a temperature measurement section to the form.
 * @return {!jQuery} The node of the new measurement div.
 */
function addMeasurement() {
  return utils.addSlowly(
      '#temperature_measurement_template', $('#temperature_measurements'));
}

/**
 * Validates temperature conditions defined in the form.
 * @param {!jQuery} node The node containing the temperature conditions div.
 * @param {?jQuery=} validateNode The target div for validation results.
 */
function validateTemperature(node, validateNode = null) {
  const temperature = unload();
  utils.validate(temperature, 'TemperatureConditions', node, validateNode);
}
