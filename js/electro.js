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

goog.module('ord.electro');
goog.module.declareLegacyNamespace();

const utils = goog.require('ord.utils');

const Current = goog.require('proto.ord.Current');
const ElectrochemistryConditions = goog.require('proto.ord.ElectrochemistryConditions');
const ElectrochemistryCell = goog.require('proto.ord.ElectrochemistryConditions.ElectrochemistryCell');
const ElectrochemistryType = goog.require('proto.ord.ElectrochemistryConditions.ElectrochemistryType');
const Measurement = goog.require('proto.ord.ElectrochemistryConditions.Measurement');
const Length = goog.require('proto.ord.Length');
const Time = goog.require('proto.ord.Time');
const Voltage = goog.require('proto.ord.Voltage');

exports = {
  load,
  unload,
  addMeasurement,
  validateElectro
};

// Freely create radio button groups by generating new input names.
let radioGroupCounter = 0;

/**
 * Adds and populates the electrochemistry conditions section in the form.
 * @param {!ElectrochemistryConditions} electro
 */
function load(electro) {
  const type = electro.getElectrochemistryType();
  if (type) {
    utils.setSelector($('#electro_type'), type.getType());
    $('#electro_details').text(type.getDetails());
  }
  utils.writeMetric('#electro_current', electro.getCurrent());
  utils.writeMetric('#electro_voltage', electro.getVoltage());
  $('#electro_anode').text(electro.getAnodeMaterial());
  $('#electro_cathode').text(electro.getCathodeMaterial());
  utils.writeMetric('#electro_separation', electro.getElectrodeSeparation());

  const cell = electro.getCell();
  if (cell) {
    utils.setSelector($('#electro_cell_type'), cell.getType());
    $('#electro_cell_details').text(cell.getDetails());
  }
  electro.getMeasurementsList().forEach(function(measurement) {
    const node = addMeasurement();
    loadMeasurement(node, measurement);
  });
}

/**
 * Adds and populates an electrochemistry measurement section in the form.
 * @param {!Node} node The target div.
 * @param {!ElectrochemistryConditions.Measurement} measurement
 */
function loadMeasurement(node, measurement) {
  const time = measurement.getTime();
  if (time) {
    utils.writeMetric('.electro_measurement_time', time, node);
  }
  const current = measurement.getCurrent();
  const voltage = measurement.getVoltage();
  if (current) {
    utils.writeMetric('.electro_measurement_current', current, node);
    $('input[value=\'current\']', node).prop('checked', true);
    $('.electro_measurement_current_fields', node).show();
    $('.electro_measurement_voltage_fields', node).hide();
  }
  if (voltage) {
    $('input[value=\'voltage\']', node).prop('checked', true);
    utils.writeMetric('.electro_measurement_voltage', voltage, node);
    $('.electro_measurement_current_fields', node).hide();
    $('.electro_measurement_voltage_fields', node).show();
  }
}

/**
 * Fetches the electrochemistry conditions defined in the form.
 * @return {!ElectrochemistryConditions}
 */
function unload() {
  const electro = new ElectrochemistryConditions();

  const type = new ElectrochemistryType();
  type.setType(utils.getSelector($('#electro_type')));
  type.setDetails($('#electro_details').text());
  if (!utils.isEmptyMessage(type)) {
    electro.setElectrochemistryType(type);
  }

  const current = utils.readMetric('#electro_current', new Current());
  if (!utils.isEmptyMessage(current)) {
    electro.setCurrent(current);
  }
  const voltage = utils.readMetric('#electro_voltage', new Voltage());
  if (!utils.isEmptyMessage(voltage)) {
    electro.setVoltage(voltage);
  }
  electro.setAnodeMaterial($('#electro_anode').text());
  electro.setCathodeMaterial($('#electro_cathode').text());
  const electrodeSeparation =
      utils.readMetric('#electro_separation', new Length());
  if (!utils.isEmptyMessage(electrodeSeparation)) {
    electro.setElectrodeSeparation(electrodeSeparation);
  }

  const cell = new ElectrochemistryCell();
  cell.setType(utils.getSelector($('#electro_cell_type')));
  cell.setDetails($('#electro_cell_details').text());
  if (!utils.isEmptyMessage(cell)) {
    electro.setCell(cell);
  }

  const measurements = [];
  $('.electro_measurement').each(function(index, node) {
    node = $(node);
    if (!utils.isTemplateOrUndoBuffer(node)) {
      const measurement = unloadMeasurement(node);
      if (!utils.isEmptyMessage(measurement)) {
        measurements.push(measurement);
      }
    }
  });
  electro.setMeasurementsList(measurements);
  return electro;
}

/**
 * Fetches an electrochemistry measurement from the form.
 * @param {!Node} node Root node of the measurement.
 * @return {!ElectrochemistryConditions.Measurement}
 */
function unloadMeasurement(node) {
  const measurement = new Measurement();
  const time = utils.readMetric('.electro_measurement_time', new Time(), node);
  if (!utils.isEmptyMessage(time)) {
    measurement.setTime(time);
  }

  if ($('.electro_measurement_current', node).is(':checked')) {
    const current =
        utils.readMetric('.electro_measurement_current', new Current(), node);
    if (!utils.isEmptyMessage(current)) {
      measurement.setCurrent(current);
    }
  }
  if ($('.electro_measurement_voltage', node).is(':checked')) {
    const voltage =
        utils.readMetric('.electro_measurement_voltage', new Voltage(), node);
    if (!utils.isEmptyMessage(voltage)) {
      measurement.setVoltage(voltage);
    }
  }
  return measurement;
}

/**
 * Adds an electrochemistry measurement section to the form.
 * @return {!Node} The newly added parent node for the measurement.
 */
function addMeasurement() {
  const node = utils.addSlowly(
      '#electro_measurement_template', $('#electro_measurements'));

  const metricButtons = $('input', node);
  metricButtons.attr('name', 'electro_' + radioGroupCounter++);
  metricButtons.change(function() {
    if (this.value === 'current') {
      $('.electro_measurement_current_fields', node).show();
      $('.electro_measurement_voltage_fields', node).hide();
    }
    if (this.value === 'voltage') {
      $('.electro_measurement_current_fields', node).hide();
      $('.electro_measurement_voltage_fields', node).show();
    }
  });

  return node;
}

/**
 * Validates the electrochemistry conditions defined in the form.
 * @param {!Node} node Root node for the electrochemistry conditions.
 * @param {?Node=} validateNode Target node for validation results.
 */
function validateElectro(node, validateNode = null) {
  const electro = unload();
  utils.validate(electro, 'ElectrochemistryConditions', node, validateNode);
}
