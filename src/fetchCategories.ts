import fetch from 'node-fetch';
const flow = require('lodash/fp/flow');
const get = require('lodash/fp/get');
const invoke = require('lodash/fp/invoke');
const isEqual = require('lodash/fp/isEqual');
const map = require('lodash/fp/map');
const remove = require('lodash/fp/remove');

import { Category, Pallet } from './types';
import { GRAPHQL_API_ENDPOINT } from './constants';

/**
 * Executes the given GraphQL query on the Marketplace endpoint, returns
 * the deserialized response value
 *
 * @returns {Promise<any>} A resolved promise with the deserialized response in
 * case of success; a rejected promise with the error message in case the
 * request failed or the response payload indicates an error.
 */
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

/**
 * Fetches all the pallets for a given Marketplace category.
 */
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

/**
 * Fetches a category with all its pallets.
 */
const fetchCategory = (category: string): Promise<Category> =>
      fetchPallets(category).then((pallets: Pallet[]) => ({ category, pallets }))

/**
 * Fetches the list of all categories and their pallets.
 */
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