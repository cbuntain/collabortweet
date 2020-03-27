package edu.umd.hcil.collabortweet.graph;

import org.graphstream.graph.Edge;

/**
 * Created by cbuntain on 5/6/17.
 */
public class EdgeTuple implements Comparable<EdgeTuple> {
    private String left;
    private String right;

    public EdgeTuple(String l, String r) {
        left = l;
        right = r;
    }

    public EdgeTuple(Edge e) {
        left = e.getSourceNode().getId();
        right = e.getTargetNode().getId();
    }

    public String getId() {
        return String.format("%s->%s", left, right);
    }

    public String getLeftId() {
        return left;
    }

    public String getRightId() {
        return right;
    }

    @Override
    public String toString() {
        return this.getId();
    }

    @Override
    public int compareTo(EdgeTuple o) {
        return this.getId().compareTo(o.getId());
    }

    @Override
    public int hashCode() {
        return this.getId().hashCode();
    }

    @Override
    public boolean equals(Object o) {
        return (o != null && o instanceof EdgeTuple) ? o.hashCode() == this.hashCode() : false;
    }
}
