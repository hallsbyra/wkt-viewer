# Actual hourglass base fill.
# The source WKT is the fact input. All output geometries use CornerProcessingInput's rotated coordinate space.
# Each connected variant replaces its selected tail or connection section and retains the other portion of that stroke.
[awkt id=hourglass-base-fill tag=base-fill label="existing base fill"]
MULTILINESTRING ((32.1421 -10, 24.1421 -10, 34.1421 -20, 34.1421 -10, 44.1421 -10, 44.1421 -30, 50 -35.8579, 54.1421 -31.7158, 54.1421 -10, 64.1421 -10, 64.1421 -21.7158, 74.1421 -11.7158, 74.1421 -10, 66.1421 -10), (32.1421 -82, 24.1421 -90, 34.1421 -90, 34.1421 -80, 44.1421 -70, 44.1421 -90, 54.1421 -90, 54.1421 -68.2842, 64.1421 -78.2842, 64.1421 -90, 74.1421 -90, 74.1421 -88.2842, 66.1421 -80.2842))
[awkt id=hourglass-B tag=B label=B]
POINT (75.8579 -10)
[awkt id=hourglass-M tag=M label=M]
POINT (78.68633 -8.82843)
[awkt id=hourglass-T tag=T label=T]
POINT (95.1716 -2)
[awkt id=hourglass-side-1 tag=side-1 label="first side"]
LINESTRING (95.1716 -2, 81.51475 -15.65685)
[awkt id=hourglass-side-2 tag=side-2 label="second side"]
LINESTRING (95.1716 -2, 75.8579 -2)
[awkt id=hourglass-raw-contour tag=raw-contour label="raw contour section"]
LINESTRING (74.1421 -10, 75.8579 -10, 74.1421 -11.7158)
[awkt id=hourglass-unclipped-centerline tag=unclipped-centerline label="unclipped B-M-T reference"]
LINESTRING (75.8579 -10, 78.68633 -8.82843, 95.1716 -2)
[awkt id=hourglass-detached-corner tag=detached-corner label="detached corner after clearance clipping"]
LINESTRING (76.1386 -9.8837, 78.6863 -8.8284, 95.1716 -2)
[awkt id=hourglass-from-tail-removed tag=from-tail-removed label="from-tail removed tail"]
LINESTRING (74.1421 -10, 72.1421 -10)
[awkt id=hourglass-from-tail-saved-rest tag=from-tail-saved-rest label="from-tail saved remainder"]
LINESTRING (72.1421 -10, 66.1421 -10)
[awkt id=hourglass-from-tail-connected-fill tag=from-tail-connected-fill label="from-tail connected fill via B-M-T"]
MULTILINESTRING ((32.1421 -10, 24.1421 -10, 34.1421 -20, 34.1421 -10, 44.1421 -10, 44.1421 -30, 50 -35.8579, 54.1421 -31.7158, 54.1421 -10, 64.1421 -10, 64.1421 -21.7158, 74.1421 -11.7158, 74.1421 -10, 75.8579 -10, 78.68633 -8.82843, 95.1716 -2), (72.1421 -10, 66.1421 -10), (32.1421 -82, 24.1421 -90, 34.1421 -90, 34.1421 -80, 44.1421 -70, 44.1421 -90, 54.1421 -90, 54.1421 -68.2842, 64.1421 -78.2842, 64.1421 -90, 74.1421 -90, 74.1421 -88.2842, 66.1421 -80.2842))
[awkt id=hourglass-to-connection-removed tag=to-connection-removed label="to-connection removed connection"]
LINESTRING (72.7279 -13.13, 74.1421 -11.7158)
[awkt id=hourglass-to-connection-saved-rest tag=to-connection-saved-rest label="to-connection saved remainder"]
MULTILINESTRING ((32.1421 -10, 24.1421 -10, 34.1421 -20, 34.1421 -10, 44.1421 -10, 44.1421 -30, 50 -35.8579, 54.1421 -31.7158, 54.1421 -10, 64.1421 -10), (64.1421 -10, 64.1421 -21.7158, 72.7279 -13.13))
[awkt id=hourglass-to-connection-connected-fill tag=to-connection-connected-fill label="to-connection connected fill via B-M-T"]
MULTILINESTRING ((95.1716 -2, 78.68633 -8.82843, 75.8579 -10, 74.1421 -11.7158, 74.1421 -10, 66.1421 -10), (32.1421 -10, 24.1421 -10, 34.1421 -20, 34.1421 -10, 44.1421 -10, 44.1421 -30, 50 -35.8579, 54.1421 -31.7158, 54.1421 -10, 64.1421 -10), (64.1421 -10, 64.1421 -21.7158, 72.7279 -13.13), (32.1421 -82, 24.1421 -90, 34.1421 -90, 34.1421 -80, 44.1421 -70, 44.1421 -90, 54.1421 -90, 54.1421 -68.2842, 64.1421 -78.2842, 64.1421 -90, 74.1421 -90, 74.1421 -88.2842, 66.1421 -80.2842))
