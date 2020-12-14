#!/usr/bin/env python
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
"""Slurp local datasets into Postgres.

Usage:
$ python alpha_migration.py --input_pattern="datasets_new/*.pbtxt"
"""

import glob
import re

from absl import app
from absl import flags
from absl import logging
import psycopg2
import psycopg2.sql

FLAGS = flags.FLAGS
flags.DEFINE_string('input_pattern', None, 'Input dataset glob.')


def main(argv):
    del argv  # Only used by app.run().
    with psycopg2.connect(dbname='editor',
                          host='localhost',
                          port=5432,
                          user='postgres') as conn:
        for filename in glob.glob(FLAGS.input_pattern):
            match = re.fullmatch(r'([0-9a-f]{32})_(.*?)\.pbtxt', filename)
            if not match:
                continue
            logging.info('Migrating %s', filename)
            user_id = match.group(1)
            name = match.group(2)
            with open(filename) as f:
                pbtxt = f.read()
            query = psycopg2.sql.SQL('UPDATE datasets SET pbtxt = %s '
                                     'WHERE user_id = %s AND dataset_name = %s')
            with conn.cursor() as cursor:
                cursor.execute(query, [pbtxt, user_id, name])
        conn.commit()


if __name__ == '__main__':
    flags.mark_flag_as_required('input_pattern')
    app.run(main)
