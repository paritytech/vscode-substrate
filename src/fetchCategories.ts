import fetch from 'node-fetch';
const flow = require('lodash/fp/flow');
const get = require('lodash/fp/get');
const invoke = require('lodash/fp/invoke');
const isEqual = require('lodash/fp/isEqual');
const map = require('lodash/fp/map');
const remove = require('lodash/fp/remove');

import { Category, Pallet } from './types';

const gq = (query: string) => (variables?: object): Promise<any> =>
  fetch(
    'https://marketplace-api-staging.substrate.dev/graphql',
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
  ).then(invoke('json')).then((d: any) => d.errors ? Promise.reject(map('message')(d.errors)) : d.data);

const fetchCategoryDetails = (category: string): Promise<Category> =>
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
    .then(flow(
      get('search.results'),
      ((pallets: Pallet[]) => ({ category, pallets })),
    ));

const fetchCategories = (): Promise<Category[]> =>
  gq('{ marketplaceCategories(type:PALLET) {name} }')()
    .then(flow(
      get('marketplaceCategories'),
      map('name'),
      remove(isEqual('tutorial')),
      map(fetchCategoryDetails),
      Promise.all.bind(Promise)
    ));

export default fetchCategories;