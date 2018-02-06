# The Onbrand Asset Obtainer

**NOTE: This is very much a MVP, and as such it is feature-incomplete, and prone to bugs!**

## 1. What is this, and what is it for?
This package is a node program to make the process of merging client assets with an [Uberflip](https://www.uberflip.com/) hub easier. The program uses [Puppeteer](https://www.npmjs.com/package/puppeteer) in order to access a client's webpage, and then intercepts all outgoing requests for style sheets. It then parses the html for inline-styles, and merges those together with the concatenated css files. Then, all the css will be combined and name-spaced to avoid conflicts with the hub, and written to the appropriate place within the [onbrand framework](https://www.npmjs.com/package/onbrand-project-generator). 


## 2. How do I use it?
The program is meant to be installed globally, and will give you access to the command `steal` once it has been installed. Calling `steal` from an onbrand-framework generated directory will begin the process, calling it elsewhere will throw an error. Once the process begins, you will be prompted to confirm you intent, then provide the url of the site you wish to steal from.

## 3. The Future
This program has been built with the intent to expand it going forward. The groundwork has been built to also obtain images, fonts, and other files needed to combine the site with [Uberflip](https://www.uberflip.com/). Building out these features should be relatively straight forward. 

The final step, would be to also automatically detect and obtain html.



