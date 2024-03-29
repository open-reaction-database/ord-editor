# Copyright 2020 Open Reaction Database Project Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Tests for editor.py.serve."""

import base64
import json
import os
import urllib

from absl.testing import absltest
from absl.testing import parameterized
from google.protobuf import text_format
from rdkit import Chem

from ord_schema import message_helpers
from ord_schema.proto import dataset_pb2
from ord_schema.proto import reaction_pb2

import serve  # pylint: disable=import-error,wrong-import-order

# These temporary datasets are leaked by tests and must be deleted in setUp().
DATASETS = [
    'dataset',
    'other',
    'test',
]


# pylint: disable=too-many-public-methods
class ServeTest(parameterized.TestCase, absltest.TestCase):

    def _create(self, dataset):
        """Make an empty dataset for testing."""
        response = self.client.post(f'/dataset/{dataset}/new',
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)

    def _destroy(self, dataset):
        """Clean up a dataset that was created for testing."""
        response = self.client.get(f'/dataset/{dataset}/delete',
                                   follow_redirects=True)
        # Returns 200 even if the dataset did not exist before.
        self.assertEqual(response.status_code, 200)

    def _destroy_datasets(self):
        for dataset in DATASETS:
            self._destroy(dataset)

    def setUp(self):
        super().setUp()
        self.test_directory = self.create_tempdir()
        serve.app.config['TESTING'] = True
        self.client = serve.app.test_client()
        # GET requests automatically login as the test user.
        self.client.get('/authenticate')
        self.testdata = os.path.join(
            os.path.dirname(os.path.realpath(__file__)), 'testdata')
        self._destroy_datasets()
        # Start with an initial empty dataset called 'dataset'.
        self._create('dataset')

    def _get_dataset(self):
        """Returns a Dataset for testing."""
        dataset = dataset_pb2.Dataset()
        with open(os.path.join(self.testdata, 'nielsen_fig1_dataset.pbtxt'),
                  'rt') as f:
            text_format.Parse(f.read(), dataset)
        # Add some unicode to check for encoding/decoding robustness.
        # From https://en.wikipedia.org/wiki/Atlantis.
        dataset.reactions[0].provenance.city = 'Ἀτλαντὶς νῆσος'
        return dataset

    def _download_dataset(self, name):
        """Downloads an existing dataset."""
        response = self.client.get(f'/dataset/{name}/download',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        return dataset_pb2.Dataset.FromString(response.data)

    def _upload_dataset(self, dataset, name):
        """Uploads a Dataset for testing."""
        response = self.client.post(f'/dataset/{name}/upload',
                                    data=text_format.MessageToString(dataset),
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)

    def test_show_root(self):
        response = self.client.get('/', follow_redirects=True)
        self.assertEqual(response.status_code, 200)

    def test_show_datasets(self):
        response = self.client.get('/datasets', follow_redirects=True)
        self.assertEqual(response.status_code, 200)

    @parameterized.parameters([
        ('dataset', 200),
        ('other', 404),
    ])
    def test_show_dataset(self, dataset, expected):
        response = self.client.get(f'/dataset/{dataset}', follow_redirects=True)
        self.assertEqual(response.status_code, expected)

    @parameterized.parameters([
        ('dataset', 200),
        ('../dataset', 404),
        (urllib.parse.quote_plus('../dataset'), 404),
        ('/foo/bar', 404),
        ('other', 404),
    ])
    def test_download_dataset(self, file_name, expected):
        response = self.client.get(f'/dataset/{file_name}/download',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, expected)
        if response.status_code == 200:
            # Make sure it parses.
            filename = os.path.join(self.test_directory, 'dataset.pb')
            with open(filename, 'wb') as f:
                f.write(response.data)
            message_helpers.load_message(filename, dataset_pb2.Dataset)

    @parameterized.parameters([
        ('dataset', 'pb', 200),
        ('dataset', 'pbtxt', 200),
        ('../dataset', 'pb', 404),
        ('../dataset', 'pbtxt', 404),
        (urllib.parse.quote_plus('../dataset'), 'pb', 404),
        (urllib.parse.quote_plus('../dataset'), 'pbtxt', 404),
        ('/foo/bar', 'pb', 404),
        ('/foo/bar', 'pbtxt', 404),
        ('other', 'pb', 404),
        ('other', 'pbtxt', 404),
    ])
    def test_download_dataset_with_kind(self, file_name, kind, expected):
        response = self.client.get(f'/dataset/{file_name}/download/{kind}',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, expected)
        if response.status_code == 200:
            # Make sure it parses.
            filename = os.path.join(self.test_directory, f'dataset.{kind}')
            with open(filename, 'wb') as f:
                f.write(response.data)
            message_helpers.load_message(filename, dataset_pb2.Dataset)

    @parameterized.parameters([
        ('dataset', 409, True),
        ('dataset', 409, False),
        ('other', 200, True),
        ('other', 200, False),
    ])
    def test_upload_dataset(self, file_name, expected, as_text):
        dataset = self._get_dataset()
        if as_text:
            data = text_format.MessageToString(dataset)
        else:
            data = dataset.SerializeToString()
        response = self.client.post(f'/dataset/{file_name}/upload',
                                    data=data,
                                    follow_redirects=True)
        self.assertEqual(response.status_code, expected)
        if response.status_code == 200:
            response = self.client.get(f'/dataset/{file_name}/download',
                                       follow_redirects=True)
            self.assertEqual(response.status_code, 200)
            downloaded_dataset = dataset_pb2.Dataset.FromString(response.data)
            self.assertEqual(downloaded_dataset, dataset)

    @parameterized.parameters([
        ('dataset', 409),
        ('other', 200),
    ])
    def test_new_dataset(self, file_name, expected):
        response = self.client.post(f'/dataset/{file_name}/new',
                                    follow_redirects=True)
        self.assertEqual(response.status_code, expected)
        if response.status_code == 200:
            dataset = self._download_dataset(file_name)
            self.assertEmpty(dataset.reactions)

    @parameterized.parameters([b'', b'data:foo/bar;base64,'])
    def test_enumerate_dataset(self, prefix):
        data = {'spreadsheet_name': 'test.csv'}
        with open(os.path.join(self.testdata, 'nielsen_fig1.csv'), 'rb') as f:
            data['spreadsheet_data'] = (prefix +
                                        base64.b64encode(f.read())).decode()
        with open(os.path.join(self.testdata, 'nielsen_fig1_template.pbtxt'),
                  'rt') as f:
            data['template_string'] = f.read()
        response = self.client.post('/dataset/enumerate',
                                    json=data,
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.get('/dataset/test_dataset/download',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        dataset = dataset_pb2.Dataset.FromString(response.data)
        self.assertLen(dataset.reactions, 80)

    @parameterized.parameters([
        (0, 200),
        (3, 200),
        (80, 404),
    ])
    def test_show_reaction(self, index, expected):
        self._upload_dataset(self._get_dataset(), 'test')
        response = self.client.get(f'/dataset/test/reaction/{index}',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, expected)

    def test_download_reaction(self):
        reaction = self._get_dataset().reactions[0]
        response = self.client.post('/reaction/download',
                                    data=reaction.SerializeToString(),
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        downloaded_reaction = reaction_pb2.Reaction()
        text_format.Parse(response.data, downloaded_reaction)
        self.assertEqual(downloaded_reaction, reaction)

    def test_new_reaction(self):
        name = 'test'
        dataset = self._get_dataset()
        self._upload_dataset(dataset, name)
        response = self.client.get(f'/dataset/{name}/new/reaction',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        downloaded_dataset = self._download_dataset(name)
        self.assertLen(downloaded_dataset.reactions, 81)

    def test_clone_reaction(self):
        name = 'test'
        dataset = self._get_dataset()
        self._upload_dataset(dataset, name)
        response = self.client.get(f'/dataset/{name}/clone/0',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        downloaded_dataset = self._download_dataset(name)
        self.assertLen(downloaded_dataset.reactions, 81)
        self.assertEqual(dataset.reactions[0], downloaded_dataset.reactions[80])

    def test_delete_reaction(self):
        name = 'test'
        dataset = self._get_dataset()
        self._upload_dataset(dataset, name)
        response = self.client.get(f'/dataset/{name}/delete/reaction/0',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        downloaded_dataset = self._download_dataset(name)
        self.assertLen(downloaded_dataset.reactions, 79)
        self.assertEqual(dataset.reactions[1], downloaded_dataset.reactions[0])

    def test_delete_reaction_id(self):
        name = 'test'
        dataset = dataset_pb2.Dataset()
        reaction_id = 'test_reaction_id'
        dataset.reaction_ids.append(reaction_id)
        self._upload_dataset(dataset, name)
        response = self.client.get(
            f'/dataset/{name}/delete/reaction_id/{reaction_id}',
            follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        downloaded_dataset = self._download_dataset(name)
        self.assertEmpty(downloaded_dataset.reaction_ids)

    def test_delete_reaction_id_blank(self):
        name = 'test'
        dataset = dataset_pb2.Dataset(reaction_ids=['', 'test', ''])
        self._upload_dataset(dataset, name)
        response = self.client.get(f'/dataset/{name}/delete/reaction_id',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        downloaded_dataset = self._download_dataset(name)
        self.assertLen(downloaded_dataset.reaction_ids, 2)

    def test_read_dataset(self):
        name = 'test'
        dataset = self._get_dataset()
        self._upload_dataset(dataset, name)
        response = self.client.get(f'/dataset/proto/read/{name}',
                                   follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        downloaded_dataset = dataset_pb2.Dataset()
        downloaded_dataset.ParseFromString(response.data)
        self.assertEqual(downloaded_dataset, dataset)

    def test_write_dataset(self):
        name = 'test'
        dataset = self._get_dataset()
        response = self.client.post(f'/dataset/proto/write/{name}',
                                    data=dataset.SerializeToString(),
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        downloaded_dataset = self._download_dataset(name)
        self.assertEqual(downloaded_dataset, dataset)

    def test_write_upload(self):
        name = 'test'
        data = b'test data'
        token = b'upload_token'
        dataset = dataset_pb2.Dataset()
        reaction = dataset.reactions.add()
        observation = reaction.observations.add()
        observation.image.bytes_value = token
        self._upload_dataset(dataset, name)
        response = self.client.post(
            f'/dataset/proto/upload/{name}/{token.decode()}',
            data=data,
            follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        # Verify that the token was resolved in the Dataset.
        downloaded_dataset = self._download_dataset(name)
        self.assertEqual(
            downloaded_dataset.reactions[0].observations[0].image.bytes_value,
            data)

    def test_read_upload(self):
        data = b'test data'
        token = 'upload_token'
        response = self.client.post(f'/dataset/proto/download/{token}',
                                    data=data,
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, data)

    @parameterized.named_parameters([
        ('percentage', reaction_pb2.Percentage(value=15.6), 0, 0),
        ('bad_precision', reaction_pb2.Percentage(precision=-15.6), 2, 0),
    ])
    def test_validate_reaction(self, message, expected_num_errors,
                               expected_num_warnings):
        response = self.client.post(
            f'/dataset/proto/validate/{message.DESCRIPTOR.name}',
            data=message.SerializeToString(),
            follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        output = json.loads(response.data)
        self.assertLen(output['errors'], expected_num_errors)
        self.assertLen(output['warnings'], expected_num_warnings)

    @parameterized.parameters([
        ('NAME', 'benzene', 'c1ccccc1'),
    ])
    def test_resolve_compound(self, identifier_type, data, expected):
        response = self.client.post(f'/resolve/{identifier_type}',
                                    data=data,
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        resolved, _ = json.loads(response.data)
        # NOTE(kearnes): Try to compensate for values from different services.
        canonical_resolved = Chem.MolToSmiles(Chem.MolFromSmiles(resolved))
        self.assertEqual(canonical_resolved, expected)

    def test_render_reaction(self):
        reaction = reaction_pb2.Reaction()
        component = reaction.inputs['test'].components.add()
        component.identifiers.add(value='c1ccccc1', type='SMILES')
        response = self.client.post('/render/reaction',
                                    data=reaction.SerializeToString(),
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)

    def test_render_compound(self):
        compound = reaction_pb2.Compound()
        compound.identifiers.add(value='c1ccccc1', type='SMILES')
        response = self.client.post('/render/reaction',
                                    data=compound.SerializeToString(),
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)

    def test_compare(self):
        name = 'test'
        dataset = self._get_dataset()
        self._upload_dataset(dataset, name)
        response = self.client.post(f'/dataset/proto/compare/{name}',
                                    data=dataset.SerializeToString(),
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        dataset.reactions[0].reaction_id = 'not the original'
        response = self.client.post(f'/dataset/proto/compare/{name}',
                                    data=dataset.SerializeToString(),
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 409)

    def test_js(self):
        pass  # Requires the editor to be built.

    @parameterized.parameters([
        ('reaction.css', 200),
        ('percentage.css', 404),
    ])
    def test_css(self, sheet, expected):
        response = self.client.get(f'/css/{sheet}', follow_redirects=True)
        self.assertEqual(response.status_code, expected)

    def test_ketcher_iframe(self):
        response = self.client.get('/ketcher/iframe', follow_redirects=True)
        self.assertEqual(response.status_code, 200)

    def test_indigo(self):
        response = self.client.get('/ketcher/info', follow_redirects=True)
        self.assertEqual(response.status_code, 204)

    def test_ketcher(self):
        pass  # Ketcher is not part of the repo, so we can't test this easily.

    @parameterized.parameters([
        'dataset/deps.js',
        'dataset/test/deps.js',
        'dataset/test/reaction/deps.js',
    ])
    def test_deps(self, path):
        response = self.client.get(path, follow_redirects=True)
        self.assertEqual(response.status_code, 200)

    def test_get_molfile(self):
        smiles = 'c1ccccc1'
        compound = reaction_pb2.Compound()
        compound.identifiers.add(value=smiles, type='SMILES')
        response = self.client.post('/ketcher/molfile',
                                    data=compound.SerializeToString(),
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.data),
                         Chem.MolToMolBlock(Chem.MolFromSmiles(smiles)))

    def test_get_molfile_no_structure(self):
        compound = reaction_pb2.Compound()
        compound.identifiers.add(value='benzene', type='NAME')
        response = self.client.post('/ketcher/molfile',
                                    data=compound.SerializeToString(),
                                    follow_redirects=True)
        self.assertEqual(response.status_code, 204)


if __name__ == '__main__':
    absltest.main()
