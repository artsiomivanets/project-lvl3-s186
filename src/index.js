import url from 'url';
import path from 'path';
import fs from 'mz/fs';
import cheerio from 'cheerio';
import axios from './lib/axios';

const generateName = (str, extFile) => {
  const { dir, name, ext } = path.parse(str);
  return path.join(dir, name)
    .split(/\W/)
    .filter(e => e !== '')
    .join('-')
    .concat(extFile || ext);
};


const findResourses = (file) => {
  const tags = {
    script: 'src',
    link: 'href',
    img: 'src',
  };

  const $ = cheerio.load(file);
  return $('html')
    .find(Object.keys(tags)
      .map(name => `${name}[${tags[name]}]`)
      .join(','))
    .map((i, elem) => {
      const attr = tags[elem.name];
      return elem.attribs[attr];
    })
    .filter((i, elem) => !elem.match(/^http/))
    .toArray();
};

const loader = (urlPath, dir = path.resolve()) => {
  const { host, pathname } = url.parse(urlPath);
  const siteName = path.join(host, pathname);

  const getData = (resourses) => {
    const queries = resourses.map(resourse =>
      axios.get(resourse, {
        baseURL: urlPath,
        responseType: 'arraybuffer',
      }));
    return Promise.all(queries).then(response =>
      response.map((res, i) => ({ path: resourses[i], data: res.data })));
  };

  const saveData = data =>
    fs.mkdir(path.join(dir, generateName(siteName, '_files')))
      .then(() =>
        Promise.all(data.map((elem) => {
          const pathToFile = path.join(dir, generateName(siteName, '_files'), generateName(elem.path));
          return fs.writeFile(pathToFile, elem.data);
        })));

  const pageName = generateName(`${host}/${pathname}`, '.html');
  const filePath = path.join(dir, pageName);

  return axios(urlPath)
    .then(res => fs.writeFile(filePath, res.data))
    .then(() => fs.readFile(filePath))
    .then(file => findResourses(file))
    .then(resourses => getData(resourses))
    .then(res => saveData(res))
    .catch(e => console.log(`Error was happend with code ${e.code}`));
};


export default loader;
