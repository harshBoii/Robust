<?php
/**
 * SEO plugin interoperability.
 *
 * When Yoast SEO or Rank Math is active it already emits a schema graph for every post.
 * Printing a second, independent graph for the same URL produces duplicate Article nodes,
 * which search engines treat as conflicting. Instead we merge our nodes into the graph the
 * SEO plugin is already building, so there is exactly one document per page.
 *
 * @package ImmortelSchemaBridge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Whether an SEO plugin owns structured data on this site.
 *
 * @return bool
 */
function immortel_sb_seo_plugin_active() {
	return immortel_sb_has_yoast() || immortel_sb_has_rankmath();
}

/**
 * @return bool True when Yoast SEO is active.
 */
function immortel_sb_has_yoast() {
	return defined( 'WPSEO_VERSION' ) || class_exists( 'WPSEO_Options' );
}

/**
 * @return bool True when Rank Math is active.
 */
function immortel_sb_has_rankmath() {
	return defined( 'RANK_MATH_VERSION' ) || class_exists( 'RankMath\\Helper' );
}

/**
 * Extract the node list from our stored document.
 *
 * Accepts either a full `{"@context":…,"@graph":[…]}` document or a single node, and
 * always returns a flat array of nodes with `@context` stripped — the SEO plugin owns the
 * top-level context of the merged document.
 *
 * @param int $post_id Post ID.
 * @return array List of schema nodes.
 */
function immortel_sb_extract_nodes( $post_id ) {
	$graph = immortel_sb_get_graph( $post_id );
	if ( null === $graph ) {
		return array();
	}

	$nodes = array();
	if ( isset( $graph['@graph'] ) && is_array( $graph['@graph'] ) ) {
		$nodes = $graph['@graph'];
	} elseif ( isset( $graph[0] ) ) {
		$nodes = $graph;
	} else {
		$nodes = array( $graph );
	}

	$clean = array();
	foreach ( $nodes as $node ) {
		if ( ! is_array( $node ) ) {
			continue;
		}
		unset( $node['@context'] );
		$clean[] = $node;
	}

	return $clean;
}

/**
 * Node types the SEO plugin already emits authoritatively.
 *
 * We defer to the SEO plugin for the page's primary Article/WebPage/Organization identity
 * and contribute only what it does not already model (FAQ, HowTo, Dataset, and similar).
 *
 * @return array
 */
function immortel_sb_reserved_types() {
	return array( 'Article', 'BlogPosting', 'NewsArticle', 'WebPage', 'WebSite', 'Organization', 'Person', 'BreadcrumbList' );
}

/**
 * Filter our nodes down to those that do not collide with the SEO plugin's own.
 *
 * @param array $nodes Candidate nodes.
 * @return array
 */
function immortel_sb_mergeable_nodes( $nodes ) {
	$reserved = immortel_sb_reserved_types();
	$out      = array();

	foreach ( $nodes as $node ) {
		if ( empty( $node['@type'] ) ) {
			continue;
		}
		$types = is_array( $node['@type'] ) ? $node['@type'] : array( $node['@type'] );
		if ( array_intersect( $types, $reserved ) ) {
			continue;
		}
		$out[] = $node;
	}

	return $out;
}

/**
 * Merge our nodes into Yoast's graph.
 *
 * @param array $data Yoast schema graph.
 * @return array
 */
function immortel_sb_yoast_graph( $data ) {
	if ( ! is_singular( 'post' ) || ! is_array( $data ) ) {
		return $data;
	}

	$nodes = immortel_sb_mergeable_nodes( immortel_sb_extract_nodes( get_the_ID() ) );
	if ( empty( $nodes ) ) {
		return $data;
	}

	return array_merge( $data, $nodes );
}
add_filter( 'wpseo_schema_graph', 'immortel_sb_yoast_graph', 20 );

/**
 * Merge our nodes into Rank Math's graph.
 *
 * Rank Math passes an associative array keyed by node id, so we key ours by type to avoid
 * clobbering entries it added.
 *
 * @param array $data Rank Math JSON-LD data.
 * @return array
 */
function immortel_sb_rankmath_graph( $data ) {
	if ( ! is_singular( 'post' ) || ! is_array( $data ) ) {
		return $data;
	}

	$nodes = immortel_sb_mergeable_nodes( immortel_sb_extract_nodes( get_the_ID() ) );
	if ( empty( $nodes ) ) {
		return $data;
	}

	foreach ( $nodes as $i => $node ) {
		$types = is_array( $node['@type'] ) ? $node['@type'] : array( $node['@type'] );
		$key   = 'immortel-' . strtolower( (string) reset( $types ) ) . '-' . $i;
		$data[ $key ] = $node;
	}

	return $data;
}
add_filter( 'rank_math/json_ld', 'immortel_sb_rankmath_graph', 20 );
