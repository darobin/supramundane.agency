
import { IdAttributePlugin, InputPathToUrlTransformPlugin, HtmlBasePlugin } from "@11ty/eleventy";
import { feedPlugin } from "@11ty/eleventy-plugin-rss";
// import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";

import pluginFilters from "./_config/filters.js";

export default async function (eleventyConfig) {
	// Drafts, see also _data/eleventyDataSchema.js
	// eleventyConfig.addPreprocessor("drafts", "*", (data, content) => {
	// 	if (data.draft && process.env.ELEVENTY_RUN_MODE === "build") return false;
	// });

	// Copy the contents of the `public` folder to the output folder
	// For example, `./public/css/` ends up in `_site/css/`
	eleventyConfig
		.addPassthroughCopy({
			"./public/": "/"
		})
		.addPassthroughCopy("./content/pretty-atom-feed.xsl")
	;

	// Run Eleventy when these files change:
	// https://www.11ty.dev/docs/watch-serve/#add-your-own-watch-targets

	// Watch images for the image pipeline.
	eleventyConfig.addWatchTarget("content/**/*.{svg,png,jpg,gif}");

	// Per-page bundles, see https://github.com/11ty/eleventy-plugin-bundle
	// Adds the {% css %} and {% js %} paired shortcodes
	eleventyConfig.addBundle("css", { toFileDirectory: "dist" });
	eleventyConfig.addBundle("js", { toFileDirectory: "dist" });

	// Official plugins
	eleventyConfig.addPlugin(HtmlBasePlugin);
	eleventyConfig.addPlugin(InputPathToUrlTransformPlugin);

	eleventyConfig.addPlugin(feedPlugin, {
		type: "atom", // or "rss", "json"
		outputPath: "/feed.atom",
		stylesheet: "pretty-atom-feed.xsl",
		templateData: {},
		collection: {
			name: "news",
			limit: 10,
		},
		metadata: {
			language: "en",
			title: "Supramundane Agency",
			subtitle: "governance & technology",
			base: "https://supramundane.agency/",
			author: {
				name: "Robin Berjon",
			},
		},
	});

	// Image optimization: https://www.11ty.dev/docs/plugins/image/#eleventy-transform
	// eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
	// 	// Output formats for each image.
	// 	formats: ["auto"],
	// 	// widths: ["auto"],
	// 	failOnError: false,
	// 	htmlOptions: {
	// 		imgAttributes: {
	// 			loading: "lazy",
	// 			decoding: "async",
	// 		},
	// 	},
	// 	sharpOptions: {
	// 		animated: true,
	// 	},
	// });

	// Filters
	eleventyConfig.addPlugin(pluginFilters);
	eleventyConfig.addPlugin(IdAttributePlugin, {
		// by default we use Eleventy’s built-in `slugify` filter:
		// slugify: eleventyConfig.getFilter("slugify"),
		// selector: "h1,h2,h3,h4,h5,h6", // default
	});
	eleventyConfig.addShortcode("currentBuildDate", () => (new Date()).toISOString());

	// If your passthrough copy gets heavy and cumbersome, add this line
	// to emulate the file copy on the dev server. Learn more:
	// https://www.11ty.dev/docs/copy/#emulate-passthrough-copy-during-serve
	// eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
}

export const config = {
	// Control which files Eleventy will process
	// e.g.: *.md, *.njk, *.html, *.liquid
	templateFormats: [
		"md",
		"njk",
		"html",
		"liquid",
		"11ty.js",
	],
	// Pre-process *.md files with: (default: `liquid`)
	markdownTemplateEngine: "njk",
	// Pre-process *.html files with: (default: `liquid`)
	htmlTemplateEngine: "njk",
	// These are all optional:
	dir: {
		input: "content",          // default: "."
		includes: "../_includes",  // default: "_includes" (`input` relative)
		data: "../_data",          // default: "_data" (`input` relative)
		output: "_site",
	},
};
