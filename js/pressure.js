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

goog.module('ord.pressure');
goog.module.declareLegacyNamespace();

const utils = goog.require('ord.utils');

const Pressure = goog.require('proto.ord.Pressure');
const PressureConditions = goog.require('proto.ord.PressureConditions');
const Atmosphere = goog.require('proto.ord.PressureConditions.Atmosphere');
const Measurement = goog.require('proto.ord.PressureConditions.Measurement');
const PressureControl = goog.require('proto.ord.PressureConditions.PressureControl');
const Time = goog.require('proto.ord.Time');

exports = {
  load,
  unload,
  addMeasurement,
  validatePressure
};


/**
 * Adds and populates the pressure conditions section in the form.
 * @param {!PressureConditions} pressure
 */
function load(pressure) {
  const control = pressure.getControl();
  if (control) {
    utils.setSelector($('#pressure_control_type'), control.getType());
    $('#pressure_control_details').text(control.getDetails());
  }
  const measurements = pressure.getMeasurementsList();
  measurements.forEach(function(measurement) {
    const node = addMeasurement();
    loadMeasurement(measurement, node);
  });
  const setpoint = pressure.getSetpoint();
  utils.writeMetric('#pressure_setpoint', setpoint);

  const atmosphere = pressure.getAtmosphere();
  if (atmosphere) {
    utils.setSelector($('#pressure_atmosphere_type'), atmosphere.getType());
    $('#pressure_atmosphere_details').text(atmosphere.getDetails());
  }
}

/**
 * Adds and populates a pressure measurement section in the form.
 * @param {!PressureConditions.Measurement} measurement
 * @param {!Node} node The target div.
 */
function loadMeasurement(measurement, node) {
  const type = measurement.getType();
  utils.setSelector($('.pressure_measurement_type', node), type);
  $('.pressure_measurement_details', node).text(measurement.getDetails());

  const pressure = measurement.getPressure();
  utils.writeMetric('.pressure_measurement_pressure', pressure, node);

  const time = measurement.getTime();
  utils.writeMetric('.pressure_measurement_time', time, node);
}

/**
 * Fetches pressure conditions from the form.
 * @return {!PressureConditions}
 */
function unload() {
  const pressure = new PressureConditions();

  const control = new PressureControl();
  control.setType(utils.getSelector($('#pressure_control_type')));
  control.setDetails($('#pressure_control_details').text());
  if (!utils.isEmptyMessage(control)) {
    pressure.setControl(control);
  }

  const setpoint = utils.readMetric('#pressure_setpoint', new Pressure());
  if (!utils.isEmptyMessage(setpoint)) {
    pressure.setSetpoint(setpoint);
  }

  const atmosphere = new Atmosphere();
  atmosphere.setType(utils.getSelector($('#pressure_atmosphere_type')));
  atmosphere.setDetails($('#pressure_atmosphere_details').text());
  if (!utils.isEmptyMessage(atmosphere)) {
    pressure.setAtmosphere(atmosphere);
  }

  const measurements = [];
  $('.pressure_measurement').each(function(index, node) {
    node = $(node);
    if (!utils.isTemplateOrUndoBuffer(node)) {
      const measurement = unloadMeasurement(node);
      if (!utils.isEmptyMessage(measurement)) {
        measurements.push(measurement);
      }
    }
  });
  pressure.setMeasurementsList(measurements);

  return pressure;
}

/**
 * Fetches a pressure measurement from the form.
 * @param {!Node} node The div of the measurement to fetch.
 * @return {!PressureConditions.Measurement}
 */
function unloadMeasurement(node) {
  const measurement = new Measurement();
  const type = utils.getSelector($('.pressure_measurement_type', node));
  measurement.setType(type);
  const details = $('.pressure_measurement_details', node).text();
  measurement.setDetails(details);
  const pressure =
      utils.readMetric('.pressure_measurement_pressure', new Pressure(), node);
  if (!utils.isEmptyMessage(pressure)) {
    measurement.setPressure(pressure);
  }
  const time = utils.readMetric('.pressure_measurement_time', new Time(), node);
  if (!utils.isEmptyMessage(time)) {
    measurement.setTime(time);
  }

  return measurement;
}

/**
 * Adds a pressure measurement section to the form.
 * @return {!Node} The node of the new measurement div.
 */
function addMeasurement() {
  return utils.addSlowly(
      '#pressure_measurement_template', $('#pressure_measurements'));
}

/**
 * Validates pressure conditions defined in the form.
 * @param {!Node} node The node containing the pressure conditions div.
 * @param {?Node=} validateNode The target div for validation results.
 */
function validatePressure(node, validateNode = null) {
  const pressure = unload();
  utils.validate(pressure, 'PressureConditions', node, validateNode);
}
