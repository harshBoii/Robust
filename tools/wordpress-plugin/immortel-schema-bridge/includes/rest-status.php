<?php
/**
 * Capability reporting endpoint.
 *
 * Immortel calls this once at connect time (and on re-verification) to decide how JSON-LD
 * can reach the rendered page. Evaluating `current_user_can` here is more reliable than
 * reading `/wp/v2/users/me?context=edit`, because it is resolved server-side against the
 * exact credential that will do the publishing.
 *
 * @package ImmortelSchemaBridge
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register GET /wp-json/immortel/v1/status.
 */
function immortel_sb_register_routes() {
	register_rest_route(
		IMMORTEL_SB_NAMESPACE,
		'/status',
		array(
			'methods'             => 'GET',
			'callback'            => 'immortel_sb_status',
			'permission_callback' => static function () {
				return current_user_can( 'edit_posts' );
			},
		)
	);
}
add_action( 'rest_api_init', 'immortel_sb_register_routes' );

/**
 * Report plugin version, SEO plugin presence, and the publishing user's capabilities.
 *
 * @return WP_REST_Response
 */
function immortel_sb_status() {
	return rest_ensure_response(
		array(
			'version'             => IMMORTEL_SB_VERSION,
			'wp_version'          => get_bloginfo( 'version' ),
			'has_yoast'           => immortel_sb_has_yoast(),
			'has_rankmath'        => immortel_sb_has_rankmath(),
			'can_unfiltered_html' => current_user_can( 'unfiltered_html' ),
			'can_publish_posts'   => current_user_can( 'publish_posts' ),
			'meta_keys'           => array(
				'json_ld' => IMMORTEL_SB_META_JSON_LD,
				'payload' => IMMORTEL_SB_META_PAYLOAD,
			),
		)
	);
}
