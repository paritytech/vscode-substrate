import fetch from 'node-fetch';
const flow = require('lodash/fp/flow');
const get = require('lodash/fp/get');
const invoke = require('lodash/fp/invoke');
const isEqual = require('lodash/fp/isEqual');
const map = require('lodash/fp/map');
const remove = require('lodash/fp/remove');

import { Category, Pallet } from './types';
import { GRAPHQL_API_ENDPOINT } from './constants';

const gq = (query: string) => (variables?: object): Promise<any> =>
  fetch(
    GRAPHQL_API_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        variables
      })
    }
  )
  .then(invoke('json'))
  .then((d: any) => d.data || Promise.reject(map('message')(d.errors)));

const fetchPallets = (category: string): Promise<Pallet[]> =>
  gq(`query($category: String!){
			search(type: PALLET query: "" category: $category) {
				results {
				...on Pallet {
						id
						name
						description
						documentation
						homepage
						github: readme
						icon
						version
						repository
					}
				}
			}
		}`)({ category })
  .then(
    get('search.results'),
   );

const fetchCategory = (category: string): Promise<Category> =>
      fetchPallets(category).then((pallets: Pallet[]) => ({ category, pallets }))

const fetchCategories = (): Promise<Category[]> =>
  gq('{ marketplaceCategories(type:PALLET) {name} }')()
    .then(flow(
      get('marketplaceCategories'),
      map('name'),
      remove(isEqual('tutorial')),
      map(fetchCategory),
      Promise.all.bind(Promise)
    ));

export default fetchCategories;